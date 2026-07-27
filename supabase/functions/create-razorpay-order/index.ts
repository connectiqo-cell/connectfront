// Supabase Edge Function: create-razorpay-order
//
// Supports single or multi-slot (same-day) checkout.
// Route transfers are intentionally NOT embedded in the order here —
// see transfer-session-payout after session completion.
import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_TIMEZONE = 'Asia/Kolkata';

function dateInAppTz(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function minutesNowInAppTz(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

/** Slot start time has already passed on today's date in app timezone. */
function isSlotStarted(dateStr: string, startTime: string, now = new Date()) {
  if (dateStr !== dateInAppTz(now)) return false;
  const [hours, mins] = String(startTime).substring(0, 5).split(':').map(Number);
  const slotMins = hours * 60 + mins;
  return slotMins <= minutesNowInAppTz(now);
}

function normalizeSlotIds(body: { slotId?: string; slotIds?: string[] }): string[] {
  if (Array.isArray(body.slotIds) && body.slotIds.length) {
    return [...new Set(body.slotIds.filter(Boolean))];
  }
  if (body.slotId) return [body.slotId];
  return [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { mentorId, learnerId, message, recordingRequested } = body;
    const slotIds = normalizeSlotIds(body);

    if (!mentorId || !learnerId || !slotIds.length) {
      throw new Error('Missing required fields: mentorId, learnerId, slotId(s)');
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

    // ── 2. Validate all slots (same day, free, mentor-owned, not started) ──
    const { data: slots, error: slotsErr } = await supabase
      .from('availability_slots')
      .select('id, mentor_id, date, start_time, end_time, is_booked')
      .in('id', slotIds);

    if (slotsErr) throw slotsErr;
    if (!slots || slots.length !== slotIds.length) {
      throw new Error('One or more selected slots were not found');
    }

    const sessionDate = slots[0].date;
    for (const slot of slots) {
      if (slot.mentor_id !== mentorId) {
        throw new Error('Selected slot does not belong to this mentor');
      }
      if (slot.is_booked) {
        throw new Error('One of the selected slots was just booked. Please choose again.');
      }
      if (slot.date !== sessionDate) {
        throw new Error('All selected slots must be on the same day');
      }
      if (isSlotStarted(slot.date, slot.start_time)) {
        throw new Error('One selected slot has already started. Please pick a later time.');
      }
    }

    const sortedSlots = [...slots].sort((a, b) =>
      String(a.start_time).substring(0, 5).localeCompare(String(b.start_time).substring(0, 5)),
    );
    for (let i = 0; i < sortedSlots.length - 1; i += 1) {
      const end = String(sortedSlots[i].end_time).substring(0, 5);
      const nextStart = String(sortedSlots[i + 1].start_time).substring(0, 5);
      if (end !== nextStart) {
        throw new Error('Selected slots must be continuous back-to-back times');
      }
    }
    // Keep slotIds ordered by start time for primary slot = first in block
    slotIds.splice(0, slotIds.length, ...sortedSlots.map((s: { id: string }) => s.id));

    // ── 3. Fetch mentor price server-side ─────────────────────────────────────
    const { data: mentorProfile, error: mpErr } = await supabase
      .from('mentor_profiles')
      .select('price_per_hour, razorpay_account_id, kyc_status')
      .eq('id', mentorId)
      .single();

    if (mpErr || !mentorProfile) throw new Error('Mentor profile not found');
    if (!mentorProfile.price_per_hour) throw new Error('Mentor has not set a price');

    // ── 4. Fetch fee rules server-side ────────────────────────────────────────
    const { data: feeRule } = await supabase
      .from('platform_fee_rules')
      .select('platform_fee_percent, gst_percent')
      .eq('is_active', true)
      .single();

    const platformFeePercent = Number(feeRule?.platform_fee_percent ?? 5);
    const gstPercent         = Number(feeRule?.gst_percent ?? 18);
    const slotCount          = slotIds.length;

    // ── 5. Calculate amounts server-side (per session × slot count) ───────────
    const mentorAmountOne    = mentorProfile.price_per_hour;
    const platformBaseFeeOne = mentorAmountOne * platformFeePercent / 100;
    const gstOnFeeOne        = platformBaseFeeOne * gstPercent / 100;
    const convenienceFeeOne  = platformBaseFeeOne + gstOnFeeOne;
    const totalAmountOne     = mentorAmountOne + convenienceFeeOne;

    const mentorAmount    = mentorAmountOne * slotCount;
    const convenienceFee  = convenienceFeeOne * slotCount;
    const totalAmount     = totalAmountOne * slotCount;

    const amountPaise       = Math.round(totalAmount) * 100;
    const mentorAmountPaise = Math.round(mentorAmount) * 100;
    const platformFeePaise  = amountPaise - mentorAmountPaise;

    // ── 6. Whether this mentor is on an activated Route linked account ────────
    const linkedAccountId = mentorProfile.razorpay_account_id;
    const kycActive       = mentorProfile.kyc_status === 'active';
    const routeEnabled    = !!(linkedAccountId && kycActive);

    // ── 7. Create Razorpay order ───────────────────────────────────────────────
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

    // ── 8. Save pending transaction (slot_id = first; slot_ids = all) ─────────
    const { error: txError } = await supabase.from('transactions').insert({
      mentor_id:            mentorId,
      learner_id:           learnerId,
      slot_id:              slotIds[0],
      slot_ids:             slotIds,
      razorpay_order_id:    order.id,
      amount_total_paise:   amountPaise,
      mentor_earning_paise: mentorAmountPaise,
      platform_fee_paise:   platformFeePaise,
      route_enabled:        routeEnabled,
      recording_requested:  recordingRequested,
      booking_message:      message || null,
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
        slotCount,
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
