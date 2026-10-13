import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { getSupabaseErrorMessage } from '../lib/supabaseErrorHandler';

const PROPOSAL_SELECT = `
  *,
  bookings (
    id, mentor_id, learner_id, reschedule_reason, status,
    profiles:mentor_id ( id, name, avatar_url ),
    availability_slots ( date, start_time, end_time )
  )
`;

function notifyReschedule(payload) {
  fetch(`${SUPABASE_URL}/functions/v1/notify-reschedule`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  }).catch(err => console.warn('notify-reschedule fire-and-forget failed:', err));
}

/** Matches connectiqo_web-portal reschedule flow (RPC-enforced statuses). */
export const rescheduleApi = {
  /**
   * Learner: mark a booking as needing reschedule after mentor no-show / technical.
   * Enforced by request_reschedule (session must have ended).
   */
  markForReschedule: async (bookingId, reason) => {
    try {
      const { error } = await supabase.rpc('request_reschedule', {
        p_booking_id: bookingId,
        p_reason: reason,
      });
      if (error) throw error;
      notifyReschedule({ type: 'reschedule_requested', bookingId });
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  /**
   * Mentor: propose a new time. Duration/conflict/attempt checks are server-side.
   */
  proposeSlot: async ({ bookingId, date, startTime, endTime }) => {
    try {
      const { data, error } = await supabase.rpc('propose_reschedule_slot', {
        p_booking_id: bookingId,
        p_date: date,
        p_start_time: startTime,
        p_end_time: endTime,
      });
      if (error) throw error;
      notifyReschedule({
        type: 'reschedule_proposed',
        bookingId,
        requestId: data.request_id,
      });
      return { requestId: data.request_id, expiresAt: data.expires_at };
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  /** "Attempt X of 3" UI — count declined proposals for this booking. */
  getDeclinedCount: async bookingId => {
    try {
      const { count, error } = await supabase
        .from('reschedule_requests')
        .select('id', { count: 'exact', head: true })
        .eq('booking_id', bookingId)
        .eq('status', 'declined');
      if (error) throw error;
      return count ?? 0;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  getPendingReschedulesForMentor: async mentorId => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          profiles:learner_id ( id, name, avatar_url ),
          availability_slots ( date, start_time, end_time )
        `)
        .eq('mentor_id', mentorId)
        .in('status', ['reschedule_needed', 'reschedule_proposed'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  getPendingReschedulesForLearner: async learnerId => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          profiles:mentor_id ( id, name, avatar_url ),
          availability_slots ( date, start_time, end_time )
        `)
        .eq('learner_id', learnerId)
        .in('status', ['reschedule_needed', 'reschedule_proposed'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  getActiveProposal: async bookingId => {
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

  getProposalsForLearner: async learnerId => {
    try {
      const { data, error } = await supabase
        .from('reschedule_requests')
        .select(PROPOSAL_SELECT)
        .eq('learner_id', learnerId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  getProposalById: async requestId => {
    try {
      const { data, error } = await supabase
        .from('reschedule_requests')
        .select(PROPOSAL_SELECT)
        .eq('id', requestId)
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  acceptProposal: async (requestId, bookingId) => {
    try {
      const { data, error } = await supabase.rpc('accept_reschedule_proposal', {
        p_request_id: requestId,
      });
      if (error) throw error;
      if (bookingId) {
        notifyReschedule({ type: 'reschedule_accepted', bookingId, requestId });
      }
      return data;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  /**
   * Decline a proposal. On the 3rd decline, booking becomes reschedule_unresolved.
   * @returns {{ unresolved: boolean }}
   */
  declineProposal: async (requestId, bookingId) => {
    try {
      const { data, error } = await supabase.rpc('decline_reschedule_proposal', {
        p_request_id: requestId,
      });
      if (error) throw error;
      if (bookingId) {
        notifyReschedule({
          type: data?.unresolved ? 'reschedule_unresolved' : 'reschedule_declined',
          bookingId,
          requestId,
        });
      }
      return { unresolved: !!data?.unresolved };
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },
};

export function rescheduleReasonLabel(reason, viewer) {
  if (reason === 'mentor_noshow') {
    return viewer === 'mentor'
      ? "You didn't join the session"
      : "Host didn't join the session";
  }
  if (reason === 'technical') {
    return 'Session ended too early (technical issue)';
  }
  return 'Session could not be completed';
}

export const RESCHEDULE_ACTIVE_STATUSES = ['reschedule_needed', 'reschedule_proposed'];
export const MAX_RESCHEDULE_ATTEMPTS = 3;
