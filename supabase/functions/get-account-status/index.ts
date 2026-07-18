// Supabase Edge Function: get-account-status
// Polls Razorpay for the mentor's linked-account KYC status (no webhook
// exists, so this is invoked on screen focus / pull-to-refresh instead).
//
// Required secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Razorpay linked-account status values: created | under_review |
// needs_clarification | activated | suspended
function mapKycStatus(rzpStatus: string | undefined): string {
  switch (rzpStatus) {
    case 'activated':          return 'active';
    case 'suspended':          return 'suspended';
    case 'needs_clarification':return 'needs_clarification';
    case 'under_review':       return 'pending';
    default:                   return 'pending';
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { mentorId } = await req.json();
    if (!mentorId) throw new Error('mentorId is required');

    // ── 1. Verify caller is the mentor (JWT sub must match mentorId) ──────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');
    if (user.id !== mentorId) throw new Error('Unauthorized: you can only view your own payout status');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: mp, error } = await supabase
      .from('mentor_profiles')
      .select('razorpay_account_id, upi_id, kyc_status')
      .eq('id', mentorId)
      .single();

    if (error) throw error;

    if (!mp?.razorpay_account_id) {
      return new Response(
        JSON.stringify({ status: 'not_started', accountId: null, upiId: mp?.upi_id || null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── 2. Fetch live status from Razorpay ─────────────────────────────────────
    const keyId     = Deno.env.get('RAZORPAY_KEY_ID')!;
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!;
    const creds     = btoa(`${keyId}:${keySecret}`);

    const rzpRes = await fetch(
      `https://api.razorpay.com/v2/accounts/${mp.razorpay_account_id}`,
      { headers: { Authorization: `Basic ${creds}` } },
    );
    const account = await rzpRes.json();
    if (!rzpRes.ok) throw new Error(account?.error?.description || 'Failed to fetch account status');

    const kycStatus = mapKycStatus(account?.status);

    // ── 3. Sync status back to DB if changed ───────────────────────────────────
    if (kycStatus !== mp.kyc_status || account?.status) {
      await supabase
        .from('mentor_profiles')
        .update({ kyc_status: kycStatus, razorpay_account_status: account?.status || null })
        .eq('id', mentorId);
    }

    return new Response(
      JSON.stringify({
        status:    kycStatus,
        accountId: mp.razorpay_account_id,
        upiId:     mp.upi_id || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('get-account-status error:', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
