// Supabase Edge Function: notify-booking-status
// Deploy: supabase functions deploy notify-booking-status
//
// Called from the app after a mentor updates booking status.
// Sends an FCM push notification to the learner.

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
          headers: { 'apns-priority': '10' },
          payload: { aps: { alert: { title, body }, sound: 'default' } },
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
// ─────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STATUS_MESSAGES: Record<string, { title: string; body: (mentorName: string) => string }> = {
  confirmed: {
    title: 'Session confirmed',
    body:  (name) => `${name} has confirmed your session. Get ready!`,
  },
  rejected: {
    title: 'Session declined',
    body:  (name) => `${name} could not accept your session. Please book another slot.`,
  },
  completed: {
    title: 'Session completed',
    body:  (name) => `Your session with ${name} is marked complete. Leave a review!`,
  },
  cancelled: {
    title: 'Session cancelled',
    body:  (name) => `Your session with ${name} has been cancelled.`,
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { bookingId, status } = await req.json();

    if (!bookingId || !status) {
      throw new Error('bookingId and status are required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Fetch booking with mentor and learner names
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        id, learner_id, mentor_id,
        mentor:profiles!mentor_id ( name ),
        learner:profiles!learner_id ( name )
      `)
      .eq('id', bookingId)
      .single();

    if (error || !booking) throw new Error('Booking not found');

    const msg = STATUS_MESSAGES[status];
    if (!msg) {
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mentorName = (booking.mentor as { name?: string } | null)?.name || 'Your mentor';
    const learnerToken = await getFcmToken(supabase, booking.learner_id);

    if (learnerToken) {
      await sendFcmNotification({
        token: learnerToken,
        title: msg.title,
        body:  msg.body(mentorName),
        data:  {
          bookingId,
          type: `booking_${status}`,
          senderName: mentorName,
        },
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('notify-booking-status error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
