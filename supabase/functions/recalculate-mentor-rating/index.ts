// Supabase Edge Function: recalculate-mentor-rating
// Deploy: supabase functions deploy recalculate-mentor-rating
//
// Called from the app after a learner submits a review. Recalculates a
// mentor's average rating from all their reviews and updates
// mentor_profiles.rating, so both web and mobile share one implementation
// instead of each needing their own copy (or having none, as before).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { mentorId } = await req.json();

    if (!mentorId) {
      throw new Error('mentorId is required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('rating')
      .eq('mentor_id', mentorId);

    if (reviewsError) throw reviewsError;

    const ratings = (reviews ?? []).map((r) => r.rating as number);
    const average = ratings.length
      ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10
      : 0;

    const { error: updateError } = await supabase
      .from('mentor_profiles')
      .update({ rating: average })
      .eq('id', mentorId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, rating: average, reviewCount: ratings.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('recalculate-mentor-rating error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
