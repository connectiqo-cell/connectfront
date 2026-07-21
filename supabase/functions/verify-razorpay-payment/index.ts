// Supabase Edge Function: verify-razorpay-payment
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
  if (!saRaw) return;
  const sa = JSON.parse(saRaw);
  const accessToken = await getFcmAccessToken(sa);
  await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: { token, notification: { title, body }, data, android: { priority: 'HIGH', notification: { channel_id: 'session_reminders', sound: 'default' } } } }) });
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      mentorId,
      learnerId,
      slotId,
      message,
      recordingRequested,
    } = await req.json();

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
      .select('mentor_earning_paise, status, booking_id, recording_requested, booking_message')
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

    // Already reconciled (e.g. retry after crash) — backfill preference if missing.
    if (tx.status === 'paid' && tx.booking_id) {
      if (typeof resolvedRecordingRequested === 'boolean') {
        await supabase
          .from('bookings')
          .update({ recording_requested: resolvedRecordingRequested })
          .eq('id', tx.booking_id)
          .is('recording_requested', null);
      }
      return new Response(
        JSON.stringify({ success: true, bookingId: tx.booking_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const mentorAmount = tx.mentor_earning_paise / 100;

    // ── 4. Check slot is still available (race-condition guard) ───────────────
    const { data: slot, error: slotErr } = await supabase
      .from('availability_slots')
      .select('is_booked')
      .eq('id', slotId)
      .single();

    if (slotErr) throw slotErr;
    if (slot.is_booked) throw new Error('This slot was just booked by someone else. Please select another slot.');

    if (typeof resolvedRecordingRequested !== 'boolean') {
      throw new Error('Recording preference is required');
    }

    // ── 5. Create booking ─────────────────────────────────────────────────────
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .insert({
        mentor_id:  mentorId,
        learner_id: learnerId,
        slot_id:    slotId,
        message:    resolvedMessage,
        recording_requested: resolvedRecordingRequested,
        status:     'confirmed',
      })
      .select()
      .single();

    if (bookingErr) {
      // Unique-violation on the active-slot index: something else (e.g. the
      // razorpay-webhook reconciler) already booked this slot for this order.
      if ((bookingErr as { code?: string }).code === '23505') {
        throw new Error('This slot was just booked by someone else. Please select another slot.');
      }
      throw bookingErr;
    }

    // ── 6. Mark slot as booked ────────────────────────────────────────────────
    await supabase.from('availability_slots').update({ is_booked: true }).eq('id', slotId);

    // ── 7. Update transaction to paid ───────────────────────────────────────────
    await supabase.from('transactions').update({
      booking_id:          booking.id,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature:  razorpaySignature,
      recording_requested: resolvedRecordingRequested,
      booking_message:     resolvedMessage,
      status:              'paid',
      updated_at:          new Date().toISOString(),
    }).eq('razorpay_order_id', razorpayOrderId);

    // ── 8. Save earnings as pending (server-calculated amount only) ────────────
    await supabase.from('earnings').insert({
      mentor_id:  mentorId,
      booking_id: booking.id,
      amount:     mentorAmount,
      status:     'pending',
    });

    // ── 9. Notify mentor of new booking (fire-and-forget) ────────────────────
    try {
      const [mentorToken, learnerProfile] = await Promise.all([
        getFcmToken(supabase, mentorId),
        supabase.from('profiles').select('name').eq('id', learnerId).single(),
      ]);
      const learnerName = (learnerProfile.data as { name?: string } | null)?.name || 'A learner';
      if (mentorToken) {
        await sendFcmNotification({
          token: mentorToken,
          title: '📅 New session booked',
          body:  `${learnerName} has booked a session with you.`,
          data:  { bookingId: booking.id, type: 'new_booking' },
        });
      }
    } catch (notifErr) {
      console.warn('Mentor FCM notify failed (non-fatal):', notifErr);
    }

    return new Response(
      JSON.stringify({ success: true, bookingId: booking.id }),
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
