// Supabase Edge Function: transfer-session-payout
// DISABLED — manual mentor payout model. Razorpay is never used to move
// money to mentors, only to collect from learners (create-razorpay-order /
// verify-razorpay-payment). Mentor earnings stay on the internal wallet
// ledger (mentor_wallets) for manual withdrawal + admin fulfilment
// regardless of any Razorpay Route account a mentor set up in the past.
//
// This function is kept only so the client's existing fire-and-forget call
// site (after complete_session_payment) doesn't 404 — it always returns
// transferred:false and never calls the Razorpay API.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  return new Response(
    JSON.stringify({ transferred: false, reason: 'manual_settlement' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
