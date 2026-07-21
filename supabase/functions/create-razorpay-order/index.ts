// Supabase Edge Function: create-razorpay-order
//
// NOTE: Route transfers are intentionally NOT embedded in the order here.
// Splitting at order-creation time would pay the mentor's linked account the
// instant the learner pays, before the session happens — removing the
// no-show protection this app relies on (earnings stay 'pending' until the
// mentor marks the session completed). The Route transfer for a routeEnabled
// transaction is created later by `transfer-session-payout`, once the
// session is marked completed.
import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { mentorId, learnerId, slotId, message, recordingRequested } = await req.json();

    if (!mentorId || !learnerId || !slotId) {
      throw new Error('Missing required fields: mentorId, learnerId, slotId');
    }
    if (typeof recordingRequested !== 'boolean') {
      throw new Error('Choose whether you want the session to be recorded');
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

    // ── 2. Fetch mentor price server-side ─────────────────────────────────────
    const { data: mentorProfile, error: mpErr } = await supabase
      .from('mentor_profiles')
      .select('price_per_hour, razorpay_account_id, kyc_status')
      .eq('id', mentorId)
      .single();

    if (mpErr || !mentorProfile) throw new Error('Mentor profile not found');
    if (!mentorProfile.price_per_hour) throw new Error('Mentor has not set a price');

    // ── 3. Fetch fee rules server-side ────────────────────────────────────────
    const { data: feeRule } = await supabase
      .from('platform_fee_rules')
      .select('platform_fee_percent, gst_percent')
      .eq('is_active', true)
      .single();

    const platformFeePercent = Number(feeRule?.platform_fee_percent ?? 5);
    const gstPercent         = Number(feeRule?.gst_percent ?? 18);

    // ── 4. Calculate amounts server-side ──────────────────────────────────────
    const mentorAmount    = mentorProfile.price_per_hour;
    const platformBaseFee = mentorAmount * platformFeePercent / 100;
    const gstOnFee        = platformBaseFee * gstPercent / 100;
    const convenienceFee  = platformBaseFee + gstOnFee;
    const totalAmount     = mentorAmount + convenienceFee;

    const amountPaise       = Math.round(totalAmount) * 100;
    const mentorAmountPaise = Math.round(mentorAmount) * 100;
    const platformFeePaise  = amountPaise - mentorAmountPaise;

    // ── 5. Whether this mentor is on an activated Route linked account ────────
    // (Used later by transfer-session-payout — no transfer happens here.)
    const linkedAccountId = mentorProfile.razorpay_account_id;
    const kycActive       = mentorProfile.kyc_status === 'active';
    const routeEnabled    = !!(linkedAccountId && kycActive);

    // ── 6. Create Razorpay order (no transfers — full amount captured to platform) ─
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization:  `Basic ${creds}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount:   amountPaise,
        currency: 'INR',
        receipt:  `rcpt_${Date.now()}`,
      }),
    });

    const order = await rzpRes.json();
    if (!rzpRes.ok) {
      throw new Error(order?.error?.description || 'Razorpay order creation failed');
    }

    // ── 7. Save pending transaction ────────────────────────────────────────────
    const { error: txError } = await supabase.from('transactions').insert({
      mentor_id:            mentorId,
      learner_id:           learnerId,
      slot_id:              slotId,
      razorpay_order_id:    order.id,
      amount_total_paise:   amountPaise,
      mentor_earning_paise: mentorAmountPaise,
      platform_fee_paise:   platformFeePaise,
      route_enabled:        routeEnabled,
      status:               'created',
    });

    if (txError) throw txError;

    return new Response(
      JSON.stringify({
        orderId:      order.id,
        amount:       order.amount,
        currency:     order.currency,
        keyId,
        routeEnabled,
        mentorAmount,
        convenienceFee,
        totalAmount,
        platformFeePercent,
        gstPercent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('create-razorpay-order error:', err);
    const msg = err instanceof Error ? err.message
      : (typeof err === 'object' && err !== null && 'message' in (err as object))
        ? (err as Record<string, unknown>).message as string
        : JSON.stringify(err);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
