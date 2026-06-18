import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendFcmNotification, getFcmToken } from '../_shared/fcm.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Events:
 *  reschedule_requested — learner marked session for reschedule → notify MENTOR
 *  reschedule_proposed  — mentor proposed a new slot           → notify LEARNER
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { type, bookingId, requestId } = await req.json();

    if (!type || !bookingId) {
      throw new Error('type and bookingId are required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Fetch booking + both profiles in one query
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        id, mentor_id, learner_id,
        mentor:profiles!mentor_id ( name ),
        learner:profiles!learner_id ( name ),
        availability_slots ( date, start_time, end_time )
      `)
      .eq('id', bookingId)
      .single();

    if (error || !booking) throw new Error('Booking not found');

    const mentorName  = (booking.mentor  as { name?: string } | null)?.name  ?? 'Your mentor';
    const learnerName = (booking.learner as { name?: string } | null)?.name  ?? 'Your learner';

    // ── reschedule_requested: learner wants to reschedule → notify mentor ──────
    if (type === 'reschedule_requested') {
      const token = await getFcmToken(supabase, booking.mentor_id);
      if (token) {
        await sendFcmNotification({
          token,
          title: '🔄 Reschedule Requested',
          body: `${learnerName} has requested a reschedule for their session. Please propose a new time.`,
          data: { bookingId, type: 'reschedule_requested' },
        });
      }
    }

    // ── reschedule_proposed: mentor proposed a slot → notify learner ───────────
    if (type === 'reschedule_proposed') {
      // Fetch the proposal for the time details
      let proposedTime = '';
      if (requestId) {
        const { data: proposal } = await supabase
          .from('reschedule_requests')
          .select('proposed_date, proposed_start_time, proposed_end_time')
          .eq('id', requestId)
          .single();

        if (proposal) {
          const d = new Date(`${proposal.proposed_date}T${proposal.proposed_start_time}`);
          proposedTime = ` on ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at ${proposal.proposed_start_time.slice(0, 5)}`;
        }
      }

      const token = await getFcmToken(supabase, booking.learner_id);
      if (token) {
        await sendFcmNotification({
          token,
          title: '📅 New Time Proposed',
          body: `${mentorName} has proposed a new time${proposedTime} for your session. Tap to review.`,
          data: { bookingId, type: 'reschedule_proposed', requestId: requestId ?? '' },
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('notify-reschedule error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
