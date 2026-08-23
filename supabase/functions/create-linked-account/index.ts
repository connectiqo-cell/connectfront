// Supabase Edge Function: create-linked-account
// Manual payout model: saves the mentor's UPI ID and/or bank account + IFSC.
// No Razorpay Route account is created — kept the function name so
// clients don't need a new endpoint.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UPI_PATTERN  = /^[\w.\-]{2,256}@[\w.\-]{2,64}$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { mentorId, upiId, bankAccount, ifsc, accountHolderName } = await req.json();

    if (!mentorId) throw new Error('mentorId is required');

    const trimmedUpi     = upiId ? String(upiId).trim() : null;
    const trimmedAccount = bankAccount ? String(bankAccount).trim() : null;
    const trimmedIfsc    = ifsc ? String(ifsc).trim().toUpperCase() : null;
    const trimmedHolder  = accountHolderName ? String(accountHolderName).trim() : null;

    const hasBank = Boolean(trimmedAccount || trimmedIfsc);
    if (!trimmedUpi && !hasBank) {
      throw new Error('Enter a UPI ID or a bank account + IFSC');
    }
    if (trimmedUpi && !UPI_PATTERN.test(trimmedUpi)) {
      throw new Error('Enter a valid UPI ID (e.g. name@bank)');
    }
    if (hasBank && (!trimmedAccount || !trimmedIfsc)) {
      throw new Error('Bank account number and IFSC are both required together');
    }
    if (trimmedIfsc && !IFSC_PATTERN.test(trimmedIfsc)) {
      throw new Error('Enter a valid IFSC code (e.g. HDFC0001234)');
    }

    // ── 1. Verify caller is the mentor (JWT sub must match mentorId) ──────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');
    if (user.id !== mentorId) throw new Error('Unauthorized: you can only set up your own payout account');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Only touch fields that were actually passed, so setting up bank details
    // doesn't wipe an existing UPI ID and vice versa.
    const updatePayload: Record<string, string> = {};
    if (trimmedUpi !== null) updatePayload.upi_id = trimmedUpi;
    if (trimmedAccount !== null) updatePayload.bank_account = trimmedAccount;
    if (trimmedIfsc !== null) updatePayload.ifsc = trimmedIfsc;
    if (trimmedHolder !== null) updatePayload.account_holder_name = trimmedHolder;

    const { error: dbError } = await supabase
      .from('mentor_profiles')
      .update(updatePayload)
      .eq('id', mentorId);

    if (dbError) throw dbError;

    return new Response(
      JSON.stringify({
        status:            'active',
        upiId:             trimmedUpi,
        bankAccount:       trimmedAccount,
        ifsc:              trimmedIfsc,
        accountHolderName: trimmedHolder,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('create-linked-account error:', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
