// Supabase Edge Function: notify-session-reminders
// Deploy: supabase functions deploy notify-session-reminders --no-verify-jwt
// Secrets: FIREBASE_SERVICE_ACCOUNT, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Optional: CRON_SECRET — if set, require header x-cron-secret
//
// Schedule (Dashboard → Edge Functions → Schedules, or pg_cron):
//   POST every 1–2 minutes to /functions/v1/notify-session-reminders
//
// Sends FCM to mentor + learner ~15 minutes before session start (Asia/Kolkata).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const APP_TIMEZONE = 'Asia/Kolkata';
const REMINDER_MINUTES = 15;
/** Inclusive window around the 15-min mark so a 1–2 min cron still catches each booking once. */
const WINDOW_BEFORE_MIN = 16;
const WINDOW_AFTER_MIN = 13;

// ── Inline FCM helper (dashboard deploy cannot resolve ../_shared) ─────────────
function base64url(s: string) {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
async function getFcmAccessToken(sa: {
  project_id: string;
  client_email: string;
  private_key: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  const h = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const p = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
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
  if (!sa.project_id || !sa.client_email || !sa.private_key) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT JSON missing project_id/client_email/private_key');
  }
  const accessToken = await getFcmAccessToken(sa);
  const stringData: Record<string, string> = {};
  for (const [k, v] of Object.entries({ title, body, ...data })) {
    stringData[k] = v == null ? '' : String(v);
  }

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
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

type SlotRow = { date: string; start_time: string };

/** Parse availability_slots date + start_time as an absolute instant in Asia/Kolkata. */
function sessionStartMs(date: string, startTime: string): number | null {
  if (!date || !startTime) return null;
  const time = String(startTime).slice(0, 8); // HH:MM:SS
  // Asia/Kolkata is fixed UTC+05:30 (no DST).
  const iso = `${date}T${time}+05:30`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function isInReminderWindow(sessionMs: number, nowMs: number): boolean {
  const minsUntil = (sessionMs - nowMs) / 60000;
  return minsUntil <= WINDOW_BEFORE_MIN && minsUntil >= WINDOW_AFTER_MIN;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (cronSecret) {
      const provided = req.headers.get('x-cron-secret') || '';
      if (provided !== cronSecret) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const nowMs = Date.now();
    // Pull a bounded set of upcoming unpaid-reminder bookings (today/tomorrow IST-ish via slot join).
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(
        `
        id,
        mentor_id,
        learner_id,
        slot_id,
        reminder_sent_at,
        slot:availability_slots!slot_id ( date, start_time ),
        mentor:profiles!mentor_id ( name ),
        learner:profiles!learner_id ( name )
      `,
      )
      .in('status', ['pending', 'confirmed'])
      .is('reminder_sent_at', null)
      .order('created_at', { ascending: false })
      .limit(300);

    if (error) throw error;

    const due = (bookings || []).filter((b) => {
      const slot = b.slot as SlotRow | SlotRow[] | null;
      const row = Array.isArray(slot) ? slot[0] : slot;
      if (!row?.date || !row?.start_time) return false;
      const startMs = sessionStartMs(row.date, row.start_time);
      if (startMs == null) return false;
      return isInReminderWindow(startMs, nowMs);
    });

    const results: Array<Record<string, unknown>> = [];

    for (const booking of due) {
      // Claim first so concurrent cron ticks don't double-send.
      const { data: claimed, error: claimErr } = await supabase
        .from('bookings')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', booking.id)
        .is('reminder_sent_at', null)
        .select('id')
        .maybeSingle();

      if (claimErr || !claimed) {
        results.push({ bookingId: booking.id, skipped: true, reason: 'already_claimed' });
        continue;
      }

      const mentorName =
        (booking.mentor as { name?: string } | null)?.name || 'your creator';
      const learnerName =
        (booking.learner as { name?: string } | null)?.name || 'a creator';

      const parties: Array<{ userId: string; title: string; body: string }> = [
        {
          userId: booking.mentor_id,
          title: 'Session reminder',
          body: `You have a session with ${learnerName} in ${REMINDER_MINUTES} minutes.`,
        },
        {
          userId: booking.learner_id,
          title: 'Session reminder',
          body: `Your session with ${mentorName} starts in ${REMINDER_MINUTES} minutes.`,
        },
      ];

      const sends: Array<Record<string, unknown>> = [];
      let anySent = false;
      let anyHardFailure = false;

      for (const party of parties) {
        const token = await getFcmToken(supabase, party.userId);
        if (!token) {
          sends.push({ userId: party.userId, skipped: true, reason: 'no_fcm_token' });
          continue;
        }
        try {
          await sendFcmNotification({
            token,
            title: party.title,
            body: party.body,
            data: {
              bookingId: String(booking.id),
              type: 'session_reminder',
              senderName: 'Connectiqo',
            },
          });
          sends.push({ userId: party.userId, sent: true });
          anySent = true;
        } catch (sendErr) {
          anyHardFailure = true;
          console.error('Reminder FCM failed', booking.id, party.userId, sendErr);
          sends.push({
            userId: party.userId,
            sent: false,
            error: sendErr instanceof Error ? sendErr.message : String(sendErr),
          });
        }
      }

      // If nothing was delivered and FCM hard-failed, clear claim so next cron can retry.
      if (!anySent && anyHardFailure) {
        await supabase
          .from('bookings')
          .update({ reminder_sent_at: null })
          .eq('id', booking.id);
      }

      results.push({ bookingId: booking.id, timezone: APP_TIMEZONE, sends });
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: (bookings || []).length,
        due: due.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('notify-session-reminders error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
