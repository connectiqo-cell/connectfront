// Supabase Edge Function: notify-reschedule
// Deploy: supabase functions deploy notify-reschedule
//
// Events:
//  reschedule_requested — learner marked session for reschedule → notify MENTOR
//  reschedule_proposed  — mentor proposed a new slot           → notify LEARNER

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Inline FCM helper (dashboard deploy cannot resolve ../_shared) ─────────────
function base64url(s: string) {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
async function getFcmAccessToken(sa: { project_id: string; client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const h = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const p = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const sigInput = `${h}.${p}`;
  const keyBuf = Uint8Array.from(
    atob(sa.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '')),
    (c) => c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyBuf,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(sigInput));
  const jwt = `${sigInput}.${base64url(String.fromCharCode(...new Uint8Array(sig)))}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`Google OAuth failed: ${JSON.stringify(json)}`);
  }
  return json.access_token as string;
}
async function sendFcmNotification({
  token,
  title,
  body,
  data = {},
}: {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  const saRaw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!saRaw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT secret is not set on this Edge Function');
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
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
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
    throw new Error(`FCM send failed: ${res.status} ${await res.text()}`);
  }
}
async function getFcmToken(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('fcm_token').eq('id', userId).single();
  return (data as { fcm_token?: string } | null)?.fcm_token ?? null;
}
// ─────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { type, bookingId, requestId } = await req.json();

    if (!type || !bookingId) {
      throw new Error('type and bookingId are required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        id, mentor_id, learner_id,
        mentor:profiles!mentor_id ( name ),
        learner:profiles!learner_id ( name )
      `)
      .eq('id', bookingId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!booking) throw new Error('Booking not found');

    const mentorName = (booking.mentor as { name?: string } | null)?.name ?? 'Your mentor';
    const learnerName = (booking.learner as { name?: string } | null)?.name ?? 'Your learner';

    if (type === 'reschedule_requested') {
      const token = await getFcmToken(supabase, booking.mentor_id);
      if (!token) {
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: 'no_fcm_token' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      await sendFcmNotification({
        token,
        title: 'Reschedule requested',
        body: `${learnerName} has requested a reschedule for their session. Please propose a new time.`,
        data: {
          bookingId: String(bookingId),
          type: 'reschedule_requested',
          senderName: learnerName,
        },
      });
    }

    if (type === 'reschedule_proposed') {
      let proposedTime = '';
      if (requestId) {
        const { data: proposal } = await supabase
          .from('reschedule_requests')
          .select('proposed_date, proposed_start_time, proposed_end_time')
          .eq('id', requestId)
          .maybeSingle();

        if (proposal?.proposed_date && proposal?.proposed_start_time) {
          proposedTime = ` on ${proposal.proposed_date} at ${String(proposal.proposed_start_time).slice(0, 5)}`;
        }
      }

      const token = await getFcmToken(supabase, booking.learner_id);
      if (!token) {
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: 'no_fcm_token' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      await sendFcmNotification({
        token,
        title: 'New time proposed',
        body: `${mentorName} has proposed a new time${proposedTime} for your session. Tap to review.`,
        data: {
          bookingId: String(bookingId),
          type: 'reschedule_proposed',
          requestId: requestId ?? '',
          senderName: mentorName,
        },
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('notify-reschedule error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
