// Supabase Edge Function: process-withdrawal
// TEST MODE: Records withdrawal request in DB only.
// When going live, integrate RazorpayX payout block (see git history).

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { mentorId, amount } = await req.json();

    if (!mentorId || !amount || amount <= 0) throw new Error('mentorId and amount are required');

    // ── 1. Verify caller is the mentor (JWT sub must match mentorId) ──────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');
    if (user.id !== mentorId) throw new Error('Unauthorized: you can only withdraw your own earnings');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── 2. Verify mentor has a payout method set up (UPI and/or bank account) ─
    const { data: mp, error: mpErr } = await supabase
      .from('mentor_profiles')
      .select('upi_id, bank_account, ifsc')
      .eq('id', mentorId)
      .single();

    if (mpErr) throw mpErr;
    const hasBankDetails = Boolean(mp?.bank_account && mp?.ifsc);
    if (!mp?.upi_id && !hasBankDetails) {
      throw new Error('No payout method found. Complete payout setup first.');
    }

    // ── 3. Atomically deduct balance (fails if insufficient) ─────────────────
    const { data: newBalance, error: deductErr } = await supabase.rpc(
      'deduct_wallet_for_withdrawal',
      { p_mentor_id: mentorId, p_amount: amount },
    );
    if (deductErr) throw new Error(deductErr.message || 'Insufficient wallet balance');

    // ── 4. Record withdrawal request ──────────────────────────────────────────
    const { data: withdrawal, error: withdrawalErr } = await supabase
      .from('withdrawal_requests')
      .insert({
        mentor_id:    mentorId,
        amount,
        upi_id:       mp.upi_id ?? null,
        bank_account: mp.bank_account ?? null,
        ifsc:         mp.ifsc ?? null,
        status:       'pending',
      })
      .select('id')
      .single();

    if (withdrawalErr) throw withdrawalErr;

    return new Response(
      JSON.stringify({
        payoutId:   `manual_${withdrawal.id}`,
        status:     'pending',
        newBalance,
        message:    'Withdrawal request recorded. Will be processed within 1–2 business days.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('process-withdrawal error:', err);
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
