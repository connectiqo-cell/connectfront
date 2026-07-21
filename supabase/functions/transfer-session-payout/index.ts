// Supabase Edge Function: transfer-session-payout
// Creates the Razorpay Route transfer for a session booking's mentor cut,
// AFTER the session has been marked completed (see complete_session_payment
// RPC). Called by the client right after that RPC succeeds.
//
// No-op (not an error) if the mentor isn't on an activated Route account —
// their earnings stay in the internal wallet ledger for manual withdrawal
// instead, same as before Route existed.
//
// Required secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { bookingId, mentorId } = await req.json();
    if (!bookingId || !mentorId) throw new Error('bookingId and mentorId are required');

    // ── 1. Verify caller is the mentor ─────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');
    if (user.id !== mentorId) throw new Error('Unauthorized: you can only transfer your own session payout');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── 2. Load the transaction (has route_enabled + the captured payment id) ─
    const { data: tx, error: txErr } = await supabase
      .from('transactions')
      .select('razorpay_payment_id, mentor_earning_paise, route_enabled')
      .eq('booking_id', bookingId)
      .eq('mentor_id', mentorId)
      .single();

    if (txErr || !tx) throw new Error('Transaction not found for this booking');

    if (!tx.route_enabled) {
      return new Response(
        JSON.stringify({ transferred: false, reason: 'not_route_enabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── 3. Idempotency: has this booking's earning already been transferred? ──
    const { data: earning, error: earnErr } = await supabase
      .from('earnings')
      .select('id, route_transfer_id')
      .eq('booking_id', bookingId)
      .eq('mentor_id', mentorId)
      .single();

    if (earnErr || !earning) throw new Error('Earnings row not found for this booking');

    if (earning.route_transfer_id) {
      return new Response(
        JSON.stringify({ transferred: true, transferId: earning.route_transfer_id, alreadyDone: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── 4. Re-check the mentor's linked account is actually activated ─────────
    const { data: mp, error: mpErr } = await supabase
      .from('mentor_profiles')
      .select('razorpay_account_id, kyc_status')
      .eq('id', mentorId)
      .single();

    if (mpErr || !mp?.razorpay_account_id || mp.kyc_status !== 'active') {
      return new Response(
        JSON.stringify({ transferred: false, reason: 'account_not_active' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!tx.razorpay_payment_id) {
      throw new Error('No captured payment id on this transaction yet');
    }

    // ── 5. Create the Route transfer from the captured payment ────────────────
    const keyId     = Deno.env.get('RAZORPAY_KEY_ID')!;
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!;
    const creds     = btoa(`${keyId}:${keySecret}`);

    const rzpRes = await fetch(
      `https://api.razorpay.com/v1/payments/${tx.razorpay_payment_id}/transfers`,
      {
        method: 'POST',
        headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transfers: [
            {
              account:  mp.razorpay_account_id,
              amount:   tx.mentor_earning_paise,
              currency: 'INR',
              on_hold:  false,
              notes:    { booking_id: bookingId, mentor_id: mentorId },
            },
          ],
        }),
      },
    );

    const result = await rzpRes.json();
    if (!rzpRes.ok) {
      throw new Error(result?.error?.description || 'Route transfer failed');
    }

    const transferId = result?.items?.[0]?.id ?? null;

    // ── 6. Record the transfer on the earnings row ─────────────────────────────
    await supabase
      .from('earnings')
      .update({ route_transfer_id: transferId, route_transferred_at: new Date().toISOString() })
      .eq('id', earning.id);

    return new Response(
      JSON.stringify({ transferred: true, transferId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('transfer-session-payout error:', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
