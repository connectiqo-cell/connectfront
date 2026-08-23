// Supabase Edge Function: notify-new-booking
// Deploy: supabase functions deploy notify-new-booking
//
// Notifies the MENTOR immediately when a learner books a session.
// Called from BookingScreen after payment, verify-razorpay-payment, and razorpay-webhook.

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
  // Handle service-account keys that store newlines as "\n" strings.
  if (typeof sa.private_key === 'string') {
    sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  }
  if (!sa.project_id || !sa.client_email || !sa.private_key) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT JSON missing project_id/client_email/private_key');
  }
  const accessToken = await getFcmAccessToken(sa);
  const stringData: Record<string, string> = {};
  for (const [k, v] of Object.entries({ title, body, ...data })) {
    stringData[k] = v == null ? '' : String(v);
  }

  // Include `notification` so Android/iOS always show a system popup when the
  // app is backgrounded or killed (data-only messages often never surface).
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
    {
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
              notification_count: 1,
            },
          },
          apns: {
            headers: {
              'apns-priority': '10',
              'apns-push-type': 'alert',
            },
            payload: {
              aps: {
                alert: { title, body },
                sound: 'default',
                badge: 1,
              },
            },
          },
        },
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error('FCM send failed:', res.status, errText);
    throw new Error(`FCM send failed: ${res.status} ${errText}`);
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
    const payload = await req.json();
    const { bookingId, test, userId } = payload as {
      bookingId?: string;
      test?: boolean;
      userId?: string;
    };

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Manual test: POST { "test": true, "userId": "<mentor-uuid>" } ─────────
    if (test) {
      if (!userId) throw new Error('userId is required when test=true');
      const token = await getFcmToken(supabase, userId);
      if (!token) {
        return new Response(
          JSON.stringify({
            success: true,
            skipped: true,
            reason: 'no_fcm_token',
            hint: 'Open the mentor app once, allow notifications, then check profiles.fcm_token',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      await sendFcmNotification({
        token,
        title: 'Connectiqo test',
        body: 'Push notifications are working on this device.',
        data: {
          type: 'test_push',
          senderName: 'Connectiqo',
        },
      });
      return new Response(
        JSON.stringify({ success: true, test: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!bookingId) {
      throw new Error('bookingId is required (or pass test=true with userId)');
    }

    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        id, mentor_id, learner_id, slot_id,
        learner:profiles!learner_id ( name )
      `)
      .eq('id', bookingId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!booking) throw new Error('Booking not found');

    const learnerName =
      (booking.learner as { name?: string } | null)?.name || 'A learner';

    let when = '';
    if (booking.slot_id) {
      const { data: slot } = await supabase
        .from('availability_slots')
        .select('date, start_time')
        .eq('id', booking.slot_id)
        .maybeSingle();
      if (slot?.date) {
        const time = String(slot.start_time || '12:00').slice(0, 5);
        const d = new Date(`${slot.date}T${time}:00`);
        if (!Number.isNaN(d.getTime())) {
          when = ` on ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at ${time}`;
        }
      }
    }

    const mentorToken = await getFcmToken(supabase, booking.mentor_id);
    if (!mentorToken) {
      console.warn('notify-new-booking: mentor has no fcm_token', booking.mentor_id);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'no_fcm_token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    await sendFcmNotification({
      token: mentorToken,
      title: 'New session booked',
      body: `${learnerName} has booked a session with you${when}.`,
      data: {
        bookingId: String(bookingId),
        type: 'new_booking',
        senderName: learnerName,
      },
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('notify-new-booking error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
