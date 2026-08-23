// Supabase Edge Function: notify-withdrawal-status
// Deploy: supabase functions deploy notify-withdrawal-status
//
// Called from the admin panel after an operator marks a withdrawal request
// processing / completed / rejected. Sends an FCM push to the mentor.

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Inline FCM helper (matches notify-booking-status's copy) ───────────────
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
// ─────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function fmtInr(amount: number): string {
  return `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

const STATUS_MESSAGES: Record<string, { title: string; body: (amount: string) => string }> = {
  processing: {
    title: 'Payout in progress',
    body:  (amt) => `We're sending ${amt} to your UPI.`,
  },
  completed: {
    title: 'Payout sent',
    body:  (amt) => `${amt} has been sent to your UPI.`,
  },
  rejected: {
    title: 'Withdrawal not sent',
    body:  (amt) => `${amt} was returned to your wallet. Check the app for details.`,
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { withdrawalRequestId, status } = await req.json();

    if (!withdrawalRequestId || !status) {
      throw new Error('withdrawalRequestId and status are required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: withdrawal, error } = await supabase
      .from('withdrawal_requests')
      .select('id, mentor_id, amount')
      .eq('id', withdrawalRequestId)
      .single();

    if (error || !withdrawal) throw new Error('Withdrawal request not found');

    const msg = STATUS_MESSAGES[status];
    if (!msg) {
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mentorToken = await getFcmToken(supabase, withdrawal.mentor_id);
    const amountLabel  = fmtInr(withdrawal.amount);

    if (mentorToken) {
      await sendFcmNotification({
        token: mentorToken,
        title: msg.title,
        body:  msg.body(amountLabel),
        data:  {
          withdrawalRequestId,
          type: `withdrawal_${status}`,
        },
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('notify-withdrawal-status error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
