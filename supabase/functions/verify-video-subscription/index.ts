// Supabase Edge Function: verify-video-subscription
// 1. Verifies Razorpay payment signature
// 2. Records learner_unlocks with expires_at (30 days)
// 3. Credits mentor earnings + wallet (idempotent, atomic)
// 4. If mentor is on an activated Route account, transfers their cut now
//    (no hold logic here — unlike session bookings there's no completion
//    event to wait for).
//
// Required secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      mentorId,
      learnerId,
    } = await req.json();

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !mentorId || !learnerId) {
      throw new Error('Missing required fields');
    }

    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!;

    // ── 1. Verify HMAC signature ──────────────────────────────────────────────
    const payload  = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expected = createHmac('sha256', keySecret).update(payload).digest('hex');

    if (expected !== razorpaySignature) {
      throw new Error('Payment verification failed: invalid signature');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── 2. Idempotency: has this exact payment already been recorded? ─────────
    const { data: existingUnlock } = await supabase
      .from('learner_unlocks')
      .select('razorpay_payment_id, expires_at')
      .eq('learner_id', learnerId)
      .eq('mentor_id', mentorId)
      .maybeSingle();

    if (existingUnlock?.razorpay_payment_id === razorpayPaymentId) {
      return new Response(
        JSON.stringify({ success: true, expiresAt: existingUnlock.expires_at }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── 3. Fetch mentor unlock price + Route account info server-side ────────
    const { data: mp, error: mpErr } = await supabase
      .from('mentor_profiles')
      .select('unlock_price, razorpay_account_id, kyc_status')
      .eq('id', mentorId)
      .single();

    if (mpErr || !mp) throw new Error('Mentor profile not found');
    if (!mp.unlock_price) throw new Error('Mentor has no subscription price set');

    // ── 4. Fetch fee rules server-side ────────────────────────────────────────
    const { data: feeRule } = await supabase
      .from('platform_fee_rules')
      .select('platform_fee_percent, gst_percent')
      .eq('is_active', true)
      .single();

    const platformFeePercent = Number(feeRule?.platform_fee_percent ?? 5);
    const gstPercent         = Number(feeRule?.gst_percent ?? 18);

    // ── 5. Recalculate amounts server-side ────────────────────────────────────
    const mentorAmount    = Number(mp.unlock_price);
    const platformBaseFee = mentorAmount * platformFeePercent / 100;
    const gstOnFee        = platformBaseFee * gstPercent / 100;
    const convenienceFee  = platformBaseFee + gstOnFee;
    const amountPaid      = Math.round(mentorAmount + convenienceFee);

    const now       = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days

    // ── 6. Record subscription with expiry ────────────────────────────────────
    const { error: unlockError } = await supabase
      .from('learner_unlocks')
      .upsert({
        learner_id:          learnerId,
        mentor_id:           mentorId,
        amount_paid:         amountPaid,
        razorpay_order_id:   razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        unlocked_at:         now.toISOString(),
        expires_at:          expiresAt.toISOString(),
      }, { onConflict: 'learner_id,mentor_id' });

    if (unlockError) throw unlockError;

    // ── 7. Record mentor earnings (server-calculated) ─────────────────────────
    const { data: earningRow, error: earningsError } = await supabase
      .from('earnings')
      .insert({
        mentor_id:  mentorId,
        amount:     mentorAmount,
        source:     'video_subscription',
        status:     'completed',
        notes:      `Video subscription by learner ${learnerId} (payment ${razorpayPaymentId})`,
      })
      .select('id')
      .single();

    if (earningsError) throw earningsError;

    // ── 8. Credit mentor wallet atomically (RPC avoids read-then-write race) ──
    const { error: walletError } = await supabase.rpc('increment_mentor_wallet', {
      p_mentor_id: mentorId,
      p_amount:    mentorAmount,
    });

    if (walletError) throw walletError;

    // Manual mentor payout model — Razorpay is never used to move money to
    // mentors. The wallet credit above (step 8) is the payout path; earnings
    // stay on the ledger for manual withdrawal + admin fulfilment regardless
    // of any Razorpay Route account a mentor set up in the past.

    return new Response(
      JSON.stringify({ success: true, expiresAt: expiresAt.toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    console.error('verify-video-subscription raw error:', JSON.stringify(err));
    let msg = 'Internal server error';
    if (err instanceof Error) {
      msg = err.message;
    } else if (typeof err === 'object' && err !== null) {
      const e = err as Record<string, unknown>;
      msg = typeof e.message === 'string' ? e.message
          : typeof e.error   === 'string' ? e.error
          : JSON.stringify(err);
    } else {
      msg = String(err);
    }
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
