// Supabase Edge Function: get-account-status
// Manual payout model: "payout ready" means the mentor has saved a UPI ID
// and/or a bank account + IFSC. No Razorpay account, no KYC polling.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      .select('upi_id, bank_account, ifsc, account_holder_name')
      .eq('id', mentorId)
      .single();

    if (error) throw error;

    const hasBankDetails = Boolean(mp?.bank_account && mp?.ifsc);

    return new Response(
      JSON.stringify({
        status:             mp?.upi_id || hasBankDetails ? 'active' : 'not_started',
        accountId:          null,
        upiId:              mp?.upi_id || null,
        bankAccount:        mp?.bank_account || null,
        ifsc:               mp?.ifsc || null,
        accountHolderName:  mp?.account_holder_name || null,
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
