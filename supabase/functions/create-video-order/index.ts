// Supabase Edge Function: create-video-order
// Creates a Razorpay order for a video library subscription.
// Separate from create-razorpay-order which is for session bookings.
//
// Also records a `video_order_intents` row so the razorpay-webhook function
// can reconcile this payment if the client never calls
// verify-video-subscription (crash, offline, killed app).
//
// Required secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { mentorId, learnerId } = await req.json();

    if (!mentorId || !learnerId) {
      throw new Error('mentorId and learnerId are required');
    }

    // ── 1. Verify caller is the learner placing the order ─────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');
    if (user.id !== learnerId) throw new Error('Unauthorized: learnerId must match authenticated user');

    const keyId     = Deno.env.get('RAZORPAY_KEY_ID')!;
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!;
    const creds     = btoa(`${keyId}:${keySecret}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── 2. Fetch mentor's unlock price server-side ────────────────────────────
    const { data: mp, error: mpErr } = await supabase
      .from('mentor_profiles')
      .select('unlock_price, razorpay_account_id, kyc_status')
      .eq('id', mentorId)
      .single();

    if (mpErr || !mp) throw new Error('Mentor profile not found');
    if (!mp.unlock_price) throw new Error('Mentor has not set a subscription price');

    // ── 3. Fetch fee rules server-side ────────────────────────────────────────
    const { data: feeRule } = await supabase
      .from('platform_fee_rules')
      .select('platform_fee_percent, gst_percent')
      .eq('is_active', true)
      .single();

    const platformFeePercent = Number(feeRule?.platform_fee_percent ?? 5);
    const gstPercent         = Number(feeRule?.gst_percent ?? 18);

    // ── 4. Calculate amounts server-side ──────────────────────────────────────
    const mentorAmount    = Number(mp.unlock_price);
    const platformBaseFee = mentorAmount * platformFeePercent / 100;
    const gstOnFee        = platformBaseFee * gstPercent / 100;
    const convenienceFee  = platformBaseFee + gstOnFee;
    const totalAmount     = mentorAmount + convenienceFee;

    const amountPaise       = Math.round(totalAmount) * 100;
    const mentorAmountPaise = Math.round(mentorAmount) * 100;
    const platformFeePaise  = amountPaise - mentorAmountPaise;

    const routeEnabled = !!(mp.razorpay_account_id && mp.kyc_status === 'active');

    // ── 5. Create Razorpay order ──────────────────────────────────────────────
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount:   amountPaise,
        currency: 'INR',
        receipt:  `vsub_${Date.now()}`,
        notes:    { mentor_id: mentorId, learner_id: learnerId, type: 'video_subscription' },
      }),
    });

    const order = await rzpRes.json();
    if (!rzpRes.ok) throw new Error(order?.error?.description || 'Order creation failed');

    // ── 6. Record the order intent for webhook reconciliation ─────────────────
    const { error: intentErr } = await supabase.from('video_order_intents').insert({
      razorpay_order_id: order.id,
      mentor_id:         mentorId,
      learner_id:        learnerId,
    });
    if (intentErr) throw intentErr;

    return new Response(
      JSON.stringify({
        orderId:           order.id,
        amount:            order.amount,
        currency:          order.currency,
        keyId,
        mentorAmountPaise,
        platformFeePaise,
        routeEnabled,
        mentorAmount,
        convenienceFee,
        totalAmount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message
      : (typeof err === 'object' && err !== null && 'message' in (err as object))
        ? (err as Record<string, unknown>).message as string
        : JSON.stringify(err);
    console.error('create-video-order error:', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
