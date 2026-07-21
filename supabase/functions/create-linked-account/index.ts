// Supabase Edge Function: create-linked-account
// Creates a real Razorpay Route linked account for a mentor and stores the
// account id. Bank/UPI + PAN verification (KYC) happens with Razorpay
// directly — they email the account's `email` to collect those details.
//
// NOTE: profile.category/subcategory below ('education'/'coaching') are a
// best-effort guess and are NOT independently verified against Razorpay's
// current accepted category list. Confirm the exact accepted values with
// Razorpay (dashboard or account manager) once Route is enabled — wrong
// values will make every account-creation call fail with a 400.
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
    const { mentorId, legalName, phone, addressLine1, city, state, postalCode, upiId } = await req.json();

    if (!mentorId || !legalName || !phone || !addressLine1 || !city || !state || !postalCode) {
      throw new Error('mentorId, legalName, phone, addressLine1, city, state and postalCode are required');
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

    // ── 2. Idempotency: don't create a second Razorpay account for the same mentor ─
    const { data: existing, error: existingErr } = await supabase
      .from('mentor_profiles')
      .select('razorpay_account_id, kyc_status')
      .eq('id', mentorId)
      .single();

    if (existingErr) throw existingErr;

    if (existing?.razorpay_account_id) {
      // Already created — just refresh the UPI display value if provided.
      if (upiId) {
        await supabase.from('mentor_profiles').update({ upi_id: upiId }).eq('id', mentorId);
      }
      return new Response(
        JSON.stringify({ accountId: existing.razorpay_account_id, status: existing.kyc_status || 'pending' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── 3. Fetch mentor's email server-side (don't trust a client-supplied email) ─
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', mentorId)
      .single();

    if (profileErr || !profile?.email) throw new Error('Could not resolve account email');

    const keyId     = Deno.env.get('RAZORPAY_KEY_ID')!;
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!;
    const creds     = btoa(`${keyId}:${keySecret}`);

    // ── 4. Create Razorpay Route linked account ───────────────────────────────
    const rzpRes = await fetch('https://api.razorpay.com/v2/accounts', {
      method: 'POST',
      headers: {
        Authorization:  `Basic ${creds}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: profile.email,
        phone,
        legal_business_name: legalName,
        customer_facing_business_name: legalName,
        business_type: 'individual',
        contact_name: legalName,
        profile: {
          category: 'education',
          subcategory: 'coaching',
          addresses: {
            registered: {
              street1:     addressLine1,
              city,
              state,
              postal_code: postalCode,
              country:     'IN',
            },
          },
        },
      }),
    });

    const account = await rzpRes.json();
    if (!rzpRes.ok) {
      throw new Error(account?.error?.description || 'Failed to create Razorpay linked account');
    }

    // ── 5. Save account id + status ────────────────────────────────────────────
    const { error: dbError } = await supabase
      .from('mentor_profiles')
      .update({
        razorpay_account_id:     account.id,
        razorpay_account_status: account.status || 'created',
        kyc_status:              'pending',
        upi_id:                  upiId || null,
      })
      .eq('id', mentorId);

    if (dbError) throw dbError;

    return new Response(
      JSON.stringify({ accountId: account.id, status: 'pending' }),
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
