// Supabase Edge Function: verify-razorpay-payment
// Supports single or multi-slot (same-day) checkout → N bookings.
import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto }       from 'https://deno.land/std@0.168.0/crypto/mod.ts';

// ── Inline FCM helper ───────────────────────────────────────────────────────────────────
function base64url(s: string) {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
async function getFcmAccessToken(sa: { project_id: string; client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const h = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const p = base64url(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sigInput = `${h}.${p}`;
  const keyBuf = Uint8Array.from(atob(sa.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '')), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', keyBuf, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(sigInput));
  const jwt = `${sigInput}.${base64url(String.fromCharCode(...new Uint8Array(sig)))}`;
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) });
  return (await res.json()).access_token as string;
}
async function sendFcmNotification({ token, title, body, data = {} }: { token: string; title: string; body: string; data?: Record<string, string> }) {
  const saRaw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!saRaw) {
    console.warn('FIREBASE_SERVICE_ACCOUNT not set');
    return;
  }
  const sa = JSON.parse(saRaw);
  if (typeof sa.private_key === 'string') {
    sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  }
  const accessToken = await getFcmAccessToken(sa);
  const stringData: Record<string, string> = {};
  for (const [k, v] of Object.entries({ title, body, ...data })) {
    stringData[k] = v == null ? '' : String(v);
  }
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: stringData,
        android: {
          priority: 'HIGH',
          notification: {
            channel_id: 'session_heads_up',
            sound: 'default',
            default_vibrate_timings: true,
          },
        },
        apns: {
          headers: {
            'apns-priority': '10',
            'apns-push-type': 'alert',
          },
          payload: { aps: { alert: { title, body }, sound: 'default', badge: 1 } },
        },
      },
    }),
  });
  if (!res.ok) {
    console.error('FCM send failed:', res.status, await res.text());
  }
}
async function getFcmToken(supabase: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('fcm_token').eq('id', userId).single();
  return (data as { fcm_token?: string } | null)?.fcm_token ?? null;
}
// ─────────────────────────────────────────────────────────────────────────────────

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

function isSlotStarted(dateStr: string, startTime: string, now = new Date()) {
  if (dateStr !== dateInAppTz(now)) return false;
  const [hours, mins] = String(startTime).substring(0, 5).split(':').map(Number);
  const slotMins = hours * 60 + mins;
  return slotMins <= minutesNowInAppTz(now);
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc     = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  const sig     = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function resolveSlotIds(tx: { slot_id?: string | null; slot_ids?: string[] | null }, body: { slotId?: string; slotIds?: string[] }) {
  if (Array.isArray(tx.slot_ids) && tx.slot_ids.length) return tx.slot_ids;
  if (Array.isArray(body.slotIds) && body.slotIds.length) return body.slotIds;
  if (tx.slot_id) return [tx.slot_id];
  if (body.slotId) return [body.slotId];
  return [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      mentorId,
      learnerId,
      message,
      recordingRequested,
    } = body;

    if (typeof recordingRequested !== 'boolean') {
      throw new Error('Recording preference is required');
    }

    // ── 1. Verify caller is the learner who initiated the order ──────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');
    if (user.id !== learnerId) throw new Error('Unauthorized: learnerId must match authenticated user');

    // ── 2. Verify Razorpay HMAC signature ──────────────────────────────────────
    const keySecret   = Deno.env.get('RAZORPAY_KEY_SECRET')!;
    const expectedSig = await hmacSha256Hex(keySecret, `${razorpayOrderId}|${razorpayPaymentId}`);
    if (expectedSig !== razorpaySignature) {
      throw new Error('Payment signature verification failed — possible tampering');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── 3. Fetch server-calculated amounts from stored transaction ────────────
    const { data: tx, error: txFetchErr } = await supabase
      .from('transactions')
      .select('mentor_earning_paise, status, booking_id, recording_requested, booking_message, slot_id, slot_ids')
      .eq('razorpay_order_id', razorpayOrderId)
      .single();

    if (txFetchErr || !tx) throw new Error('Transaction not found for this order');

    const resolvedRecordingRequested =
      typeof tx.recording_requested === 'boolean'
        ? tx.recording_requested
        : recordingRequested;

    const resolvedMessage =
      (typeof message === 'string' && message.trim())
        ? message.trim()
        : (tx.booking_message || null);

    const slotIds = resolveSlotIds(tx, body);
    if (!slotIds.length) throw new Error('No slots found for this order');

    // Already reconciled (e.g. retry after crash) — backfill preference if missing.
    if (tx.status === 'paid' && tx.booking_id) {
      if (typeof resolvedRecordingRequested === 'boolean') {
        await supabase
          .from('bookings')
          .update({ recording_requested: resolvedRecordingRequested })
          .in('id', [tx.booking_id])
          .is('recording_requested', null);
      }
      return new Response(
        JSON.stringify({
          success: true,
          bookingId: tx.booking_id,
          bookingIds: [tx.booking_id],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (typeof resolvedRecordingRequested !== 'boolean') {
      throw new Error('Recording preference is required');
    }

    // ── 4. Race-check all slots still available + not started ───────────────
    const { data: slots, error: slotsErr } = await supabase
      .from('availability_slots')
      .select('id, date, start_time, end_time, is_booked')
      .in('id', slotIds);

    if (slotsErr) throw slotsErr;
    if (!slots || slots.length !== slotIds.length) {
      throw new Error('One or more slots are no longer available');
    }
    for (const slot of slots) {
      if (slot.is_booked) {
        throw new Error('One of the selected slots was just booked by someone else. Please select again.');
      }
      if (isSlotStarted(slot.date, slot.start_time)) {
        throw new Error('One selected slot has already started. Please pick a later time.');
      }
    }

    const sortedSlots = [...slots].sort((a: { start_time: string }, b: { start_time: string }) =>
      String(a.start_time).substring(0, 5).localeCompare(String(b.start_time).substring(0, 5)),
    );
    for (let i = 0; i < sortedSlots.length - 1; i += 1) {
      const end = String((sortedSlots[i] as { end_time?: string }).end_time || '').substring(0, 5);
      const nextStart = String(sortedSlots[i + 1].start_time).substring(0, 5);
      if (!end || end !== nextStart) {
        throw new Error('Selected slots must be continuous back-to-back times');
      }
    }
    const orderedSlotIds = sortedSlots.map((s: { id: string }) => s.id);
    const slotCount = orderedSlotIds.length;
    const mentorAmountTotal = tx.mentor_earning_paise / 100;

    // ── 5/6. Atomically claim every slot + create the booking + pending
    // earnings row in one DB transaction (claim_and_book_slots RPC, see
    // 20260819000000_atomic_claim_and_book_slots.sql). The earlier SELECT
    // (step 4) is only a fast-path friendly-error check — the RPC's
    // UPDATE ... WHERE is_booked = false is the actual guard: Postgres
    // row-locks each targeted slot during that update, so two concurrent
    // callers can never both win the same slot.
    const { data: primaryBookingId, error: claimErr } = await supabase.rpc('claim_and_book_slots', {
      p_mentor_id: mentorId,
      p_learner_id: learnerId,
      p_slot_ids: orderedSlotIds,
      p_message: resolvedMessage,
      p_recording_requested: resolvedRecordingRequested,
      p_mentor_amount: mentorAmountTotal,
    });

    if (claimErr) {
      if (String(claimErr.message).startsWith('SLOT_ALREADY_BOOKED')) {
        throw new Error('One of the selected slots was just booked by someone else. Please select again.');
      }
      throw claimErr;
    }

    const bookingIds = primaryBookingId ? [primaryBookingId] : [];

    // ── 7. Update transaction to paid ───────────────────────────────────────────
    await supabase.from('transactions').update({
      booking_id:          primaryBookingId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature:  razorpaySignature,
      recording_requested: resolvedRecordingRequested,
      booking_message:     resolvedMessage,
      status:              'paid',
      updated_at:          new Date().toISOString(),
    }).eq('razorpay_order_id', razorpayOrderId);

    // ── 8. Notify mentor of new booking ────────────────────────────────────
    try {
      const [mentorToken, learnerProfile] = await Promise.all([
        getFcmToken(supabase, mentorId),
        supabase.from('profiles').select('name').eq('id', learnerId).single(),
      ]);
      const learnerName = (learnerProfile.data as { name?: string } | null)?.name || 'A learner';
      if (mentorToken) {
        const bodyText = slotCount > 1
          ? `${learnerName} booked a continuous ${slotCount}-block session with you.`
          : `${learnerName} has booked a session with you.`;
        await sendFcmNotification({
          token: mentorToken,
          title: 'New session booked',
          body:  bodyText,
          data:  {
            bookingId: primaryBookingId,
            type: 'new_booking',
            senderName: learnerName,
          },
        });
      } else {
        console.warn('verify-razorpay-payment: mentor has no fcm_token', mentorId);
      }
    } catch (notifErr) {
      console.warn('Mentor FCM notify failed (non-fatal):', notifErr);
    }

    return new Response(
      JSON.stringify({ success: true, bookingId: primaryBookingId, bookingIds }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('verify-razorpay-payment error:', err);
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
