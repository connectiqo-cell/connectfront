// Supabase Edge Function: verify-play-purchase
// Verifies a Google Play Billing one-time-product purchase (video subscription
// unlock, paid via Play Billing instead of Razorpay on Android), credits the
// mentor, grants the 30-day unlock. Mirrors verify-video-subscription's
// Razorpay flow, but the amount is Google-collected — not client-supplied —
// so there's no equivalent of Razorpay's HMAC signature check needed here;
// the purchaseToken itself is only valid if Google actually processed a real
// charge for it.
//
// The client must call finishTransaction({ isConsumable: true }) AFTER this
// succeeds — that's what makes the SKU purchasable again for the next 30-day
// cycle. This function does not consume/acknowledge on Google's side itself.
//
// Required secrets: GOOGLE_PLAY_SERVICE_ACCOUNT (service-account JSON with
// Android Publisher API access), ANDROID_PACKAGE_NAME (optional, defaults to com.myapp)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function base64url(s: string) {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function getGoogleAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const h = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const p = base64url(JSON.stringify({
    iss:   sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }));
  const sigInput = `${h}.${p}`;
  const keyBuf = Uint8Array.from(
    atob(sa.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '')),
    c => c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey('pkcs8', keyBuf, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(sigInput));
  const jwt = `${sigInput}.${base64url(String.fromCharCode(...new Uint8Array(sig)))}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error_description || 'Failed to get Google access token');
  return json.access_token as string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { mentorId, learnerId, productId, purchaseToken } = await req.json();
    if (!mentorId || !learnerId || !productId || !purchaseToken) {
      throw new Error('mentorId, learnerId, productId and purchaseToken are required');
    }

    // ── 1. Verify caller is the learner ────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');
    if (user.id !== learnerId) throw new Error('Unauthorized: learnerId must match authenticated user');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── 2. Idempotency: has this exact purchase token already been processed? ──
    const { data: existingUnlock } = await supabase
      .from('learner_unlocks')
      .select('play_purchase_token, expires_at')
      .eq('learner_id', learnerId)
      .eq('mentor_id', mentorId)
      .maybeSingle();

    if (existingUnlock?.play_purchase_token === purchaseToken) {
      return new Response(
        JSON.stringify({ success: true, expiresAt: existingUnlock.expires_at, alreadyProcessed: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── 3. Verify the purchase with the Google Play Developer API ─────────────
    const saRaw = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT');
    if (!saRaw) throw new Error('Google Play service account not configured');
    const sa = JSON.parse(saRaw);
    const accessToken = await getGoogleAccessToken(sa);

    const packageName = Deno.env.get('ANDROID_PACKAGE_NAME') || 'com.myapp';
    const verifyRes = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const purchase = await verifyRes.json();
    if (!verifyRes.ok) {
      throw new Error(purchase?.error?.message || 'Failed to verify purchase with Google Play');
    }

    // purchaseState: 0 = Purchased, 1 = Canceled, 2 = Pending
    if (purchase.purchaseState !== 0) {
      throw new Error(`Purchase not in a completed state (purchaseState=${purchase.purchaseState})`);
    }

    // ── 4. Fetch mentor unlock price + fee rules server-side ──────────────────
    // (The actual charge is whatever's configured on the Play product — not
    // client-supplied — so this is for computing the mentor's/platform's split
    // of that amount, same accounting model as the Razorpay flow.)
    const { data: mp, error: mpErr } = await supabase
      .from('mentor_profiles')
      .select('unlock_price')
      .eq('id', mentorId)
      .single();
    if (mpErr || !mp?.unlock_price) throw new Error('Mentor profile / unlock_price not found');

    const { data: feeRule } = await supabase
      .from('platform_fee_rules')
      .select('platform_fee_percent, gst_percent')
      .eq('is_active', true)
      .single();

    const platformFeePercent = Number(feeRule?.platform_fee_percent ?? 5);
    const gstPercent         = Number(feeRule?.gst_percent ?? 18);
    const mentorAmount       = Number(mp.unlock_price);
    const platformBaseFee    = mentorAmount * platformFeePercent / 100;
    const gstOnFee           = platformBaseFee * gstPercent / 100;
    const amountPaid         = Math.round(mentorAmount + platformBaseFee + gstOnFee);

    const now       = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // ── 5. Record the unlock ───────────────────────────────────────────────────
    const { error: unlockErr } = await supabase.from('learner_unlocks').upsert({
      learner_id:           learnerId,
      mentor_id:            mentorId,
      amount_paid:          amountPaid,
      play_purchase_token:  purchaseToken,
      unlocked_at:          now.toISOString(),
      expires_at:           expiresAt.toISOString(),
    }, { onConflict: 'learner_id,mentor_id' });
    if (unlockErr) throw unlockErr;

    // ── 6. Record mentor earnings + credit wallet (atomic RPC) ────────────────
    const { error: earningsErr } = await supabase.from('earnings').insert({
      mentor_id: mentorId,
      amount:    mentorAmount,
      source:    'video_subscription',
      status:    'completed',
      notes:     `Video subscription by learner ${learnerId} (Google Play purchase)`,
    });
    if (earningsErr) throw earningsErr;

    const { error: walletErr } = await supabase.rpc('increment_mentor_wallet', {
      p_mentor_id: mentorId,
      p_amount:    mentorAmount,
    });
    if (walletErr) throw walletErr;

    return new Response(
      JSON.stringify({ success: true, expiresAt: expiresAt.toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('verify-play-purchase error:', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
