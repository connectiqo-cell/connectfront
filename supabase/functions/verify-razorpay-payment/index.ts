// Supabase Edge Function: verify-razorpay-payment
// Deploy: supabase functions deploy verify-razorpay-payment
//
// This function:
//   1. Verifies Razorpay HMAC signature (prevents payment spoofing)
//   2. Creates the booking (atomically)
//   3. Marks the availability slot as booked
//   4. Updates transaction status to 'paid'
//   5. Saves earnings as PENDING (wallet credited only after session completes)

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto }       from 'https://deno.land/std@0.168.0/crypto/mod.ts';

// ── Inline FCM helper ─────────────────────────────────────────────────────────
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
// ─────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc     = new TextEncoder();
  const keyData = enc.encode(secret);
  const msgData = enc.encode(message);

  const key = await crypto.subtle.importKey(
    'raw', keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );

  const sig     = await crypto.subtle.sign('HMAC', key, msgData);
  const hashArr = Array.from(new Uint8Array(sig));
  return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

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

    // ── 1. Verify signature ───────────────────────────────────────────────────
    const keySecret   = Deno.env.get('RAZORPAY_KEY_SECRET')!;
    const body        = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSig = await hmacSha256Hex(keySecret, body);

    if (expectedSig !== razorpaySignature) {
      throw new Error('Payment signature verification failed — possible tampering');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── 2. Fetch stored transaction to get server-calculated amounts ──────────
    // mentor_earning_paise was set by create-razorpay-order — never trust client
    const { data: tx, error: txFetchErr } = await supabase
      .from('transactions')
      .select('mentor_earning_paise')
      .eq('razorpay_order_id', razorpayOrderId)
      .single();

    if (txFetchErr || !tx) throw new Error('Transaction not found for this order');

    const mentorAmount = tx.mentor_earning_paise / 100;

    // ── 3. Check slot is still available (race-condition guard) ───────────────
    const { data: slot, error: slotErr } = await supabase
      .from('availability_slots')
      .select('is_booked')
      .eq('id', slotId)
      .single();

    if (slotErr) throw slotErr;
    if (slot.is_booked) {
      throw new Error('This slot was just booked by someone else. Please select another slot.');
    }

    // ── 4. Create booking with status = confirmed ─────────────────────────────
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .insert({
        mentor_id:  mentorId,
        learner_id: learnerId,
        slot_id:    slotId,
        message:    message || null,
        recording_requested: recordingRequested,
        status:     'confirmed',
      })
      .select()
      .single();

    if (bookingErr) throw bookingErr;

    // ── 5. Mark slot as booked ────────────────────────────────────────────────
    await supabase
      .from('availability_slots')
      .update({ is_booked: true })
      .eq('id', slotId);

    // ── 6. Update transaction: paid + link booking ────────────────────────────
    await supabase
      .from('transactions')
      .update({
        booking_id:           booking.id,
        razorpay_payment_id:  razorpayPaymentId,
        razorpay_signature:   razorpaySignature,
        status:               'paid',
        updated_at:           new Date().toISOString(),
      })
      .eq('razorpay_order_id', razorpayOrderId);

    // ── 7. Save earnings as PENDING (server-calculated amount only) ───────────
    await supabase.from('earnings').insert({
      mentor_id:  mentorId,
      booking_id: booking.id,
      amount:     mentorAmount,
      status:     'pending',
    });

    // ── 8. Notify mentor of new booking ──────────────────────────────────────
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
