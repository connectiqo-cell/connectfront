// Supabase Edge Function: razorpay-webhook
// Server-to-server reconciliation for payments the client never confirmed
// (app crashed/lost network right after Razorpay captured the charge).
// This is the safety net behind create-razorpay-order/verify-razorpay-payment
// and create-video-order/verify-video-subscription, which are otherwise the
// only place payment success gets recorded.
//
// Setup required (one-time, in Razorpay Dashboard → Settings → Webhooks):
//   URL: https://pkoaxfxejgaawtwnkhvk.supabase.co/functions/v1/razorpay-webhook
//   Events: payment.captured, payment.failed
//   Secret: generate one, set it as RAZORPAY_WEBHOOK_SECRET in Supabase
//           Edge Function secrets (separate from RAZORPAY_KEY_SECRET).
//
// verify_jwt is OFF for this function — Razorpay can't send a Supabase JWT.
// Authenticity is instead verified via Razorpay's own HMAC signature below.
//
// Required secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function logAudit(
  supabase: ReturnType<typeof createClient>,
  action: string,
  entity: string,
  payload: unknown,
) {
  try {
    await supabase.from('audit_logs').insert({
      actor_email: 'razorpay-webhook',
      action,
      entity,
      environment: 'production',
      payload,
    });
  } catch (e) {
    console.error('audit log insert failed (non-fatal):', e);
  }
}

// Mirrors the reconciliation done by verify-razorpay-payment, for a payment
// the client never confirmed. Safe to call even if the client wins the race
// in parallel — guarded by transaction status + a unique index on
// bookings(slot_id) WHERE status <> 'cancelled'.
// Supports multi-slot orders via tx.slot_ids (falls back to [slot_id]).
async function reconcileSessionBooking(
  supabase: ReturnType<typeof createClient>,
  tx: {
    id: string;
    mentor_id: string;
    learner_id: string;
    slot_id: string;
    slot_ids?: string[] | null;
    mentor_earning_paise: number;
    status: string;
    recording_requested?: boolean | null;
    booking_message?: string | null;
  },
  paymentId: string,
) {
  if (tx.status !== 'created') {
    return { outcome: 'already_handled' };
  }

  const slotIds =
    Array.isArray(tx.slot_ids) && tx.slot_ids.length
      ? tx.slot_ids
      : tx.slot_id
        ? [tx.slot_id]
        : [];
  if (!slotIds.length) throw new Error('Transaction has no slot_id(s)');

  const { data: slots, error: slotErr } = await supabase
    .from('availability_slots')
    .select('id, start_time, end_time, is_booked')
    .in('id', slotIds);
  if (slotErr) throw slotErr;

  const anyBooked = (slots || []).some((s: { is_booked: boolean }) => s.is_booked);
  if (anyBooked || (slots || []).length !== slotIds.length) {
    // Client verify likely already won (or slots vanished). Mark paid if still created.
    await supabase
      .from('transactions')
      .update({ status: 'paid', razorpay_payment_id: paymentId, updated_at: new Date().toISOString() })
      .eq('id', tx.id)
      .eq('status', 'created');
    return { outcome: 'already_handled' };
  }

  const sortedSlots = [...(slots || [])].sort((a: { start_time: string }, b: { start_time: string }) =>
    String(a.start_time).substring(0, 5).localeCompare(String(b.start_time).substring(0, 5)),
  );
  for (let i = 0; i < sortedSlots.length - 1; i += 1) {
    const end = String(sortedSlots[i].end_time || '').substring(0, 5);
    const nextStart = String(sortedSlots[i + 1].start_time).substring(0, 5);
    if (!end || end !== nextStart) {
      throw new Error('Selected slots must be continuous back-to-back times');
    }
  }
  const orderedSlotIds = sortedSlots.map((s: { id: string }) => s.id);
  const primarySlotId = orderedSlotIds[0];

  const bookingRow: Record<string, unknown> = {
    mentor_id: tx.mentor_id,
    learner_id: tx.learner_id,
    slot_id: primarySlotId,
    slot_ids: orderedSlotIds,
    status: 'confirmed',
  };
  if (typeof tx.recording_requested === 'boolean') {
    bookingRow.recording_requested = tx.recording_requested;
  }
  if (typeof tx.booking_message === 'string' && tx.booking_message.trim()) {
    bookingRow.message = tx.booking_message.trim();
  }

  const { data: bookings, error: bookingErr } = await supabase
    .from('bookings')
    .insert([bookingRow])
    .select();

  if (bookingErr) {
    // Unique-violation on the active-slot index means the client's verify
    // call won the race between our slot check above and this insert.
    if ((bookingErr as { code?: string }).code === '23505') {
      await supabase
        .from('transactions')
        .update({ status: 'paid', razorpay_payment_id: paymentId, updated_at: new Date().toISOString() })
        .eq('id', tx.id)
        .eq('status', 'created');
      return { outcome: 'already_handled' };
    }
    throw bookingErr;
  }

  const created = bookings || [];
  const primaryBookingId = created[0]?.id;
  const mentorAmountTotal = tx.mentor_earning_paise / 100;

  await supabase.from('availability_slots').update({ is_booked: true }).in('id', orderedSlotIds);

  await supabase
    .from('transactions')
    .update({
      booking_id: primaryBookingId,
      razorpay_payment_id: paymentId,
      status: 'paid',
      updated_at: new Date().toISOString(),
    })
    .eq('id', tx.id);

  if (primaryBookingId) {
    await supabase.from('earnings').insert([{
      mentor_id: tx.mentor_id,
      booking_id: primaryBookingId,
      amount: mentorAmountTotal,
      status: 'pending',
    }]);
  }

  // Push mentor immediately via notify-new-booking (no shared import — dashboard-safe).
  if (primaryBookingId) {
    try {
      const base = Deno.env.get('SUPABASE_URL');
      const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (base && key) {
        const res = await fetch(`${base}/functions/v1/notify-new-booking`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            apikey: key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ bookingId: primaryBookingId }),
        });
        if (!res.ok) {
          console.warn('razorpay-webhook notify-new-booking failed:', res.status, await res.text());
        }
      }
    } catch (notifErr) {
      console.warn('razorpay-webhook mentor FCM failed (non-fatal):', notifErr);
    }
  }

  return { outcome: 'reconciled', bookingId: primaryBookingId, bookingIds: primaryBookingId ? [primaryBookingId] : [] };
}

// Mirrors verify-video-subscription, for a payment the client never confirmed.
async function reconcileVideoSubscription(
  supabase: ReturnType<typeof createClient>,
  intent: { mentor_id: string; learner_id: string },
  orderId: string,
  paymentId: string,
  keyId: string,
  keySecret: string,
) {
  const { data: existingUnlock } = await supabase
    .from('learner_unlocks')
    .select('razorpay_payment_id, expires_at')
    .eq('learner_id', intent.learner_id)
    .eq('mentor_id', intent.mentor_id)
    .maybeSingle();

  if (existingUnlock?.razorpay_payment_id === paymentId) {
    return { outcome: 'already_handled' };
  }

  const { data: mp, error: mpErr } = await supabase
    .from('mentor_profiles')
    .select('unlock_price, razorpay_account_id, kyc_status')
    .eq('id', intent.mentor_id)
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
  const mentorAmountPaise  = Math.round(mentorAmount) * 100;

  const now       = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { error: unlockErr } = await supabase.from('learner_unlocks').upsert({
    learner_id:          intent.learner_id,
    mentor_id:           intent.mentor_id,
    amount_paid:         amountPaid,
    razorpay_order_id:   orderId,
    razorpay_payment_id: paymentId,
    unlocked_at:         now.toISOString(),
    expires_at:          expiresAt.toISOString(),
  }, { onConflict: 'learner_id,mentor_id' });
  if (unlockErr) throw unlockErr;

  const { data: earningRow, error: earningsErr } = await supabase
    .from('earnings')
    .insert({
      mentor_id: intent.mentor_id,
      amount:    mentorAmount,
      source:    'video_subscription',
      status:    'completed',
      notes:     `Video subscription by learner ${intent.learner_id} (payment ${paymentId}, reconciled via webhook)`,
    })
    .select('id')
    .single();
  if (earningsErr) throw earningsErr;

  const { error: walletErr } = await supabase.rpc('increment_mentor_wallet', {
    p_mentor_id: intent.mentor_id,
    p_amount:    mentorAmount,
  });
  if (walletErr) throw walletErr;

  try {
    if (mp.razorpay_account_id && mp.kyc_status === 'active') {
      const creds = btoa(`${keyId}:${keySecret}`);
      const rzpRes = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/transfers`, {
        method: 'POST',
        headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transfers: [{
            account: mp.razorpay_account_id,
            amount: mentorAmountPaise,
            currency: 'INR',
            on_hold: false,
            notes: { mentor_id: intent.mentor_id, learner_id: intent.learner_id, type: 'video_subscription' },
          }],
        }),
      });
      const result = await rzpRes.json();
      if (rzpRes.ok) {
        const transferId = result?.items?.[0]?.id ?? null;
        await supabase
          .from('earnings')
          .update({ route_transfer_id: transferId, route_transferred_at: new Date().toISOString() })
          .eq('id', earningRow.id);
      }
    }
  } catch (transferErr) {
    console.warn('Route transfer error (non-fatal):', transferErr);
  }

  return { outcome: 'reconciled' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok');
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';
  const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')!;

  const expectedSig = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  if (expectedSig !== signature) {
    console.error('razorpay-webhook: signature mismatch');
    return json({ error: 'Invalid signature' }, 401);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const event = body?.event;
  const paymentEntity = body?.payload?.payment?.entity;

  try {
    if (event === 'payment.captured' && paymentEntity) {
      const orderId   = paymentEntity.order_id;
      const paymentId = paymentEntity.id;
      if (!orderId || !paymentId) return json({ error: 'Missing order_id/payment_id' }, 400);

      const { data: tx } = await supabase
        .from('transactions')
        .select('id, mentor_id, learner_id, slot_id, slot_ids, mentor_earning_paise, status, recording_requested, booking_message')
        .eq('razorpay_order_id', orderId)
        .maybeSingle();

      if (tx) {
        const result = await reconcileSessionBooking(supabase, tx, paymentId);
        if (result.outcome === 'reconciled') {
          await logAudit(supabase, 'webhook_reconciled_session_booking', orderId, { orderId, paymentId, bookingId: result.bookingId });
        }
        return json({ received: true, ...result });
      }

      const { data: intent } = await supabase
        .from('video_order_intents')
        .select('mentor_id, learner_id')
        .eq('razorpay_order_id', orderId)
        .maybeSingle();

      if (intent) {
        const keyId     = Deno.env.get('RAZORPAY_KEY_ID')!;
        const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!;
        const result = await reconcileVideoSubscription(supabase, intent, orderId, paymentId, keyId, keySecret);
        if (result.outcome === 'reconciled') {
          await logAudit(supabase, 'webhook_reconciled_video_subscription', orderId, { orderId, paymentId });
        }
        return json({ received: true, ...result });
      }

      // No record of this order at all — can't safely reconcile automatically.
      await logAudit(supabase, 'webhook_unreconciled_payment', orderId, body);
      console.error('razorpay-webhook: unreconciled payment.captured', orderId, paymentId);
      return json({ received: true, outcome: 'unreconciled' });
    }

    if (event === 'payment.failed' && paymentEntity) {
      const orderId = paymentEntity.order_id;
      if (orderId) {
        await supabase
          .from('transactions')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('razorpay_order_id', orderId)
          .eq('status', 'created');
      }
      return json({ received: true });
    }

    // Any other event type: acknowledge but don't act (e.g. refund events are
    // not handled yet — logged so they're at least visible for manual review).
    await logAudit(supabase, 'webhook_event_ignored', event ?? 'unknown', body);
    return json({ received: true, ignored: true });
  } catch (err) {
    console.error('razorpay-webhook processing error:', err);
    await logAudit(supabase, 'webhook_processing_error', event ?? 'unknown', { error: String(err), body });
    // 500 so Razorpay retries — this is our failure, not a signal to give up.
    return json({ error: 'Internal processing error' }, 500);
  }
});
