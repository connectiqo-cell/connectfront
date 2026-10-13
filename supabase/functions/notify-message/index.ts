// Supabase Edge Function: notify-message
// Deploy: supabase functions deploy notify-message --no-verify-jwt
//
// Called by the messages_notify_recipient DB trigger (pg_net) on every new
// row in public.messages -> pushes an FCM notification to the OTHER party.
// Body: { messageId }. Everything else is looked up server-side, and only
// messages created in the last 2 minutes are accepted, so calling this
// directly can at most re-send a push for a message that was just sent.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// -- Inline FCM helper (same as notify-reschedule; dashboard deploy cannot resolve ../_shared) --
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
            channel_id: 'session_reminders',
            sound: 'default',
            default_vibrate_timings: true,
            // One tray entry per conversation: a newer message replaces the older one.
            tag: data.conversationId ?? undefined,
          },
        },
        apns: {
          headers: { 'apns-priority': '10', ...(data.conversationId ? { 'apns-collapse-id': data.conversationId } : {}) },
          payload: { aps: { alert: { title, body }, sound: 'default' } },
        },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`FCM send failed: ${res.status} ${await res.text()}`);
  }
}
// ---------------------------------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const MAX_AGE_MS = 2 * 60 * 1000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { messageId } = await req.json();
    if (!messageId) throw new Error('messageId is required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: message, error } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, body, created_at')
      .eq('id', messageId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!message) throw new Error('Message not found');

    if (Date.now() - new Date(message.created_at).getTime() > MAX_AGE_MS) {
      return json({ success: true, skipped: true, reason: 'stale_message' });
    }

    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .select('id, mentor_id, learner_id')
      .eq('id', message.conversation_id)
      .maybeSingle();
    if (convError) throw new Error(convError.message);
    if (!conv) throw new Error('Conversation not found');

    const recipientId = message.sender_id === conv.mentor_id ? conv.learner_id : conv.mentor_id;

    const { data: people, error: peopleError } = await supabase
      .from('profiles')
      .select('id, name, fcm_token')
      .in('id', [message.sender_id, recipientId]);
    if (peopleError) throw new Error(peopleError.message);

    const sender = people?.find((p) => p.id === message.sender_id);
    const recipient = people?.find((p) => p.id === recipientId);
    const token = recipient?.fcm_token;
    if (!token) {
      return json({ success: true, skipped: true, reason: 'no_fcm_token' });
    }

    const senderName = sender?.name || 'New message';
    const text = String(message.body);

    await sendFcmNotification({
      token,
      title: senderName,
      body: text.length > 140 ? `${text.slice(0, 137)}...` : text,
      data: {
        type: 'new_message',
        conversationId: String(conv.id),
        senderName,
      },
    });

    return json({ success: true });
  } catch (err) {
    console.error('notify-message error:', err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});
