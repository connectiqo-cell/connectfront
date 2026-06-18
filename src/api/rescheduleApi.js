import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { getSupabaseErrorMessage } from '../lib/supabaseErrorHandler';

function notifyReschedule(payload) {
  fetch(`${SUPABASE_URL}/functions/v1/notify-reschedule`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  }).catch(err => console.warn('notify-reschedule fire-and-forget failed:', err));
}

export const rescheduleApi = {
  /**
   * Mark a booking as needing reschedule. Called after failed/missed session.
   * reason: 'mentor_noshow' | 'technical'
   */
  markForReschedule: async (bookingId, reason) => {
    try {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 7); // 7-day window to propose

      const { data, error } = await supabase
        .from('bookings')
        .update({
          status: 'reschedule_pending',
          reschedule_reason: reason,
          reschedule_deadline: deadline.toISOString(),
        })
        .eq('id', bookingId)
        .select()
        .single();

      if (error) throw error;
      // Fire-and-forget: notify mentor that learner requested a reschedule
      notifyReschedule({ type: 'reschedule_requested', bookingId });
      return data;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  /**
   * Mentor: get bookings waiting for a reschedule proposal.
   */
  getPendingReschedulesForMentor: async (mentorId) => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          profiles:learner_id ( id, name, avatar_url ),
          availability_slots ( date, start_time, end_time )
        `)
        .eq('mentor_id', mentorId)
        .eq('status', 'reschedule_pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  /**
   * Learner: get bookings in reschedule_pending state (waiting for mentor's proposal).
   */
  getPendingReschedulesForLearner: async (learnerId) => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          profiles:mentor_id ( id, name, avatar_url ),
          availability_slots ( date, start_time, end_time )
        `)
        .eq('learner_id', learnerId)
        .eq('status', 'reschedule_pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  /**
   * Mentor: propose a new dedicated time for this booking.
   */
  proposeSlot: async ({ bookingId, mentorId, learnerId, date, startTime, endTime, reason }) => {
    try {
      // Expire any previous pending proposals for this booking
      await supabase
        .from('reschedule_requests')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('booking_id', bookingId)
        .eq('status', 'pending');

      const { data, error } = await supabase
        .from('reschedule_requests')
        .insert({
          booking_id: bookingId,
          mentor_id: mentorId,
          learner_id: learnerId,
          reason,
          proposed_date: date,           // 'YYYY-MM-DD'
          proposed_start_time: startTime, // 'HH:MM:SS'
          proposed_end_time: endTime,
        })
        .select()
        .single();

      if (error) throw error;
      // Fire-and-forget: notify learner that mentor proposed a new time
      notifyReschedule({ type: 'reschedule_proposed', bookingId, requestId: data.id });
      return data;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  /**
   * Get the active (pending) proposal for a booking.
   */
  getActiveProposal: async (bookingId) => {
    try {
      const { data, error } = await supabase
        .from('reschedule_requests')
        .select('*')
        .eq('booking_id', bookingId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data || null;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  /**
   * Learner: get all proposals waiting for their response (across all bookings).
   */
  getProposalsForLearner: async (learnerId) => {
    try {
      const { data, error } = await supabase
        .from('reschedule_requests')
        .select(`
          *,
          bookings (
            id, mentor_id, learner_id, reschedule_reason,
            profiles:mentor_id ( id, name, avatar_url ),
            availability_slots ( date, start_time, end_time )
          )
        `)
        .eq('learner_id', learnerId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  /**
   * Learner: accept a proposal. Atomically creates new booking via DB RPC.
   */
  acceptProposal: async (requestId) => {
    try {
      const { data, error } = await supabase.rpc('accept_reschedule_proposal', {
        p_request_id: requestId,
      });
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  /**
   * Learner: decline a proposal. Mentor can submit another one.
   */
  declineProposal: async (requestId) => {
    try {
      const { error } = await supabase
        .from('reschedule_requests')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .eq('id', requestId);
      if (error) throw error;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },
};
