import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function base64url(data: Uint8Array): string {
  const bytes = Array.from(data);
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function encodeJson(obj: unknown): string {
  return base64url(new TextEncoder().encode(JSON.stringify(obj)));
}

async function signHS256(secret: string, input: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input));
  return base64url(new Uint8Array(sig));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey    = Deno.env.get('VIDEOSDK_API_KEY');
    const apiSecret = Deno.env.get('VIDEOSDK_API_SECRET');

    if (!apiKey || !apiSecret) {
      throw new Error('VIDEOSDK_API_KEY and VIDEOSDK_API_SECRET must be set in Supabase secrets');
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 86400; // 24 hours

    const header  = encodeJson({ alg: 'HS256', typ: 'JWT' });
    const payload = encodeJson({
      apikey:      apiKey,
      permissions: ['ask_join', 'allow_join', 'allow_mod'],
      version:     2,
      iat:         now,
      exp,
    });

    const sig   = await signHS256(apiSecret, `${header}.${payload}`);
    const token = `${header}.${payload}.${sig}`;

    return new Response(
      JSON.stringify({ success: true, token, expiresIn: 86400 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('get-videosdk-token error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
