// Supabase Edge Function: verify-apple-purchase
// Verifies an Apple StoreKit Consumable in-app purchase (video subscription
// unlock, paid via Apple IAP instead of Razorpay/Play Billing on iOS),
// credits the mentor, grants the 30-day unlock. Mirrors verify-play-purchase's
// structure — the App Store Server API lookup itself IS the verification (the
// transactionId is only valid if Apple actually processed a real purchase for
// it), same trust model as Play Billing's purchaseToken lookup.
//
// The client must call finishTransaction({ isConsumable: true }) AFTER this
// succeeds — that's what makes the SKU purchasable again for the next 30-day
// cycle. This function does not finish the transaction on Apple's side itself.
//
// Required secrets: APPLE_ISSUER_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY (contents
// of the .p8 In-App Purchase key downloaded from App Store Connect),
// APPLE_BUNDLE_ID (optional, defaults to com.connectiqo.app)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Must match src/utils/appleBilling.js's APPLE_UNLOCK_PRODUCT_IDS — kept in
// sync manually since edge functions can't import from the app's src/ tree.
const PRODUCT_ID_BY_PRICE: Record<number, string> = {
  199: 'video_unlock_199',
  299: 'video_unlock_299',
  499: 'video_unlock_499',
  799: 'video_unlock_799',
  999: 'video_unlock_999',
};

function base64url(bytes: Uint8Array | string): string {
  const s = typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(input.length + (4 - (input.length % 4)) % 4, '=');
  return atob(padded);
}

async function getAppleJwt(): Promise<string> {
  const issuerId   = Deno.env.get('APPLE_ISSUER_ID')!;
  const keyId      = Deno.env.get('APPLE_KEY_ID')!;
  const privateKey = Deno.env.get('APPLE_PRIVATE_KEY')!;
  const bundleId   = Deno.env.get('APPLE_BUNDLE_ID') || 'com.connectiqo.app';

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: issuerId,
    iat: now,
    exp: now + 1200,
    aud: 'appstoreconnect-v1',
    bid: bundleId,
  }));
  const signingInput = `${header}.${payload}`;

  const pemBody = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const keyBuffer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  // Web Crypto's ECDSA signature output is raw IEEE P1363 (r||s) — exactly
  // what JWS ES256 expects, no DER conversion needed (unlike some other
  // crypto libraries).
  const sigBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const sig = base64url(new Uint8Array(sigBuffer));
  return `${signingInput}.${sig}`;
}

async function fetchAppleTransaction(transactionId: string, jwt: string) {
  const hosts = [
    'https://api.storekit.itunes.apple.com',
    'https://api.storekit-sandbox.itunes.apple.com',
  ];

  let lastError: string | null = null;
  for (const host of hosts) {
    const res = await fetch(`${host}/inApps/v1/transactions/${transactionId}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (res.ok) {
      const json = await res.json();
      const [, payloadSegment] = String(json.signedTransactionInfo).split('.');
      return JSON.parse(base64urlDecode(payloadSegment));
    }
    lastError = await res.text();
    // 404 here means "not found in this environment" — try the other one
    // (production vs sandbox) before giving up.
    if (res.status !== 404) break;
  }
  throw new Error(`Apple transaction lookup failed: ${lastError}`);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { mentorId, learnerId, productId, transactionId } = await req.json();
    if (!mentorId || !learnerId || !productId || !transactionId) {
      throw new Error('mentorId, learnerId, productId and transactionId are required');
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

    // ── 2. Idempotency: has this exact transaction already been recorded? ─────
    const { data: existingUnlock } = await supabase
      .from('learner_unlocks')
      .select('apple_transaction_id, expires_at')
      .eq('learner_id', learnerId)
      .eq('mentor_id', mentorId)
      .maybeSingle();

    if (existingUnlock?.apple_transaction_id === transactionId) {
      return new Response(
        JSON.stringify({ success: true, expiresAt: existingUnlock.expires_at, alreadyProcessed: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── 3. Verify the transaction with the App Store Server API ───────────────
    const jwt = await getAppleJwt();
    const transaction = await fetchAppleTransaction(transactionId, jwt);

    if (transaction.productId !== productId) {
      throw new Error('Transaction product does not match the reported product');
    }

    // ── 4. Fetch mentor unlock price server-side ──────────────────────────────
    const { data: mp, error: mpErr } = await supabase
      .from('mentor_profiles')
      .select('unlock_price')
      .eq('id', mentorId)
      .single();
    if (mpErr || !mp?.unlock_price) throw new Error('Mentor profile / unlock_price not found');

    // Reject if the purchased product doesn't match the mentor's *current*
    // price tier — prevents a learner buying a cheaper tier's product while
    // the mentor's configured price is actually higher.
    const expectedProductId = PRODUCT_ID_BY_PRICE[mp.unlock_price];
    if (!expectedProductId || expectedProductId !== productId) {
      throw new Error('Purchased product does not match this mentor\'s current unlock price');
    }

    // ── 5. Fetch fee rules server-side ─────────────────────────────────────────
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

    // ── 6. Record the unlock ───────────────────────────────────────────────────
    const { error: unlockErr } = await supabase.from('learner_unlocks').upsert({
      learner_id:           learnerId,
      mentor_id:            mentorId,
      amount_paid:          amountPaid,
      apple_transaction_id: transactionId,
      unlocked_at:          now.toISOString(),
      expires_at:           expiresAt.toISOString(),
    }, { onConflict: 'learner_id,mentor_id' });
    if (unlockErr) throw unlockErr;

    // ── 7. Record mentor earnings + credit wallet (atomic RPC) ────────────────
    const { error: earningsErr } = await supabase.from('earnings').insert({
      mentor_id: mentorId,
      amount:    mentorAmount,
      source:    'video_subscription',
      status:    'completed',
      notes:     `Video subscription by learner ${learnerId} (Apple In-App Purchase)`,
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
    console.error('verify-apple-purchase error:', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
