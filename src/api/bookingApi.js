import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { getSupabaseErrorMessage } from '../lib/supabaseErrorHandler';
import { cancelSessionReminder } from '../utils/sessionReminder';
import { recordingsApi } from './recordingsApi';

/** Fetch recordings for a list of bookings and merge them in (no FK → can't use PostgREST join). */
async function attachRecordings(bookings) {
  if (!bookings?.length) return bookings;
  const ids = bookings.map(b => b.id);
  try {
    const { data: recs } = await supabase
      .from('recordings')
      .select('booking_id, meeting_id, recording_url, recording_playback_url')
      .in('booking_id', ids);
    const recMap = {};
    (recs || []).forEach(r => { recMap[r.booking_id] = r; });
    return bookings.map(b => ({ ...b, recordings: recMap[b.id] ?? null }));
  } catch {
    return bookings.map(b => ({ ...b, recordings: null }));
  }
}

export const bookingApi = {
  createBooking: async ({ learnerId, mentorId, slotId, message }) => {
    try {
      // Verify slot is still available before booking
      const { data: slot, error: slotCheckError } = await supabase
        .from('availability_slots')
        .select('is_booked')
        .eq('id', slotId)
        .single();

      if (slotCheckError) throw slotCheckError;
      if (slot?.is_booked) {
        throw new Error('This time slot was just booked by someone else. Please choose a different slot.');
      }

      // Create the booking
      const { data, error } = await supabase
        .from('bookings')
        .insert([
          {
            learner_id: learnerId,
            mentor_id: mentorId,
            slot_id: slotId,
            message: message || null,
            status: 'pending',
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Mark the availability slot as booked
      const { error: slotError } = await supabase
        .from('availability_slots')
        .update({ is_booked: true })
        .eq('id', slotId);

      if (slotError) throw slotError;

      return data;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  getBooking: async (bookingId) => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          profiles!learner_id ( name, avatar_url ),
          mentor_profile:profiles!mentor_id ( id, name, avatar_url ),
          availability_slots ( date, start_time, end_time )
        `)
        .eq('id', bookingId)
        .single();

      if (error) throw error;
      const [withRec] = await attachRecordings([data]);
      return withRec;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  getBookingsByLearner: async (learnerId) => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          profiles:mentor_id ( id, name, avatar_url ),
          availability_slots ( date, start_time, end_time )
        `)
        .eq('learner_id', learnerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return attachRecordings(data || []);
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  getUpcomingBookingsByLearner: async (learnerId) => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          profiles:mentor_id (id, name, avatar_url),
          availability_slots (date, start_time, end_time)
        `)
        .eq('learner_id', learnerId)
        .in('status', ['pending', 'confirmed', 'reschedule_pending']);

      if (error) throw error;
      const sorted = (data || []).sort((a, b) => {
        const da = `${a.availability_slots?.date ?? ''} ${a.availability_slots?.start_time ?? ''}`;
        const db = `${b.availability_slots?.date ?? ''} ${b.availability_slots?.start_time ?? ''}`;
        return da.localeCompare(db);
      });
      return attachRecordings(sorted);
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  getBookingHistoryByLearner: async (learnerId, page = 0, pageSize = 10) => {
    try {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          profiles:mentor_id (id, name, avatar_url),
          availability_slots (date, start_time, end_time)
        `)
        .eq('learner_id', learnerId)
        .in('status', ['completed', 'cancelled', 'rejected', 'rescheduled'])
        .order('date', { referencedTable: 'availability_slots', ascending: false })
        .order('start_time', { referencedTable: 'availability_slots', ascending: false })
        .range(from, to);

      if (error) throw error;
      return attachRecordings(data || []);
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  getBookingsByMentor: async (mentorId) => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          profiles:learner_id ( id, name, avatar_url ),
          availability_slots ( date, start_time, end_time )
        `)
        .eq('mentor_id', mentorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return attachRecordings(data || []);
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  getUpcomingBookingsByMentor: async (mentorId) => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          profiles:learner_id (id, name, avatar_url),
          availability_slots (date, start_time, end_time)
        `)
        .eq('mentor_id', mentorId)
        .in('status', ['pending', 'confirmed', 'reschedule_pending']);

      if (error) throw error;
      const sorted = (data || []).sort((a, b) => {
        const da = `${a.availability_slots?.date ?? ''} ${a.availability_slots?.start_time ?? ''}`;
        const db = `${b.availability_slots?.date ?? ''} ${b.availability_slots?.start_time ?? ''}`;
        return da.localeCompare(db);
      });
      return attachRecordings(sorted);
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  getBookingHistoryByMentor: async (mentorId, page = 0, pageSize = 10) => {
    try {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          profiles:learner_id (id, name, avatar_url),
          availability_slots (date, start_time, end_time)
        `)
        .eq('mentor_id', mentorId)
        .in('status', ['completed', 'cancelled', 'rejected', 'rescheduled'])
        .order('date', { referencedTable: 'availability_slots', ascending: false })
        .order('start_time', { referencedTable: 'availability_slots', ascending: false })
        .range(from, to);

      if (error) throw error;
      return attachRecordings(data || []);
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  /**
   * Completed 1-on-1s for a mentor (for public mentor profile).
   * May return [] if RLS blocks the viewer — depends on your Supabase policies.
   */
  getCompletedSessionsForMentorProfile: async (mentorId, { limit = 12 } = {}) => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          message,
          status,
          created_at,
          profiles:learner_id (id, name, avatar_url),
          availability_slots (date, start_time, end_time),
          reviews ( rating )
        `)
        .eq('mentor_id', mentorId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return attachRecordings(data || []);
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  /** Learner-facing: completed sessions with this mentor (for profile recap list). */
  getCompletedSessionsWithMentor: async ({ learnerId, mentorId, limit = 15 }) => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          message,
          status,
          created_at,
          availability_slots ( date, start_time, end_time )
        `)
        .eq('learner_id', learnerId)
        .eq('mentor_id', mentorId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return attachRecordings(data || []);
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  updateBookingStatus: async ({ bookingId, status }) => {
    try {

      // Only update if not already completed — prevents double-processing when
      // both mentor and learner call this at session end.
      const { data, error } = await supabase
        .from('bookings')
        .update({ status })
        .eq('id', bookingId)
        .neq('status', status)
        .select()
        .single();

      if (error) throw error;

      // data is null when the row was already in this status — skip side effects
      if (!data) return null;

      // If status is 'completed':
      // 1. Increment mentor's total_sessions (atomic — won't run twice due to guard above)
      // 2. Move earnings from pending → available balance (complete_session_payment RPC)
      if (status === 'completed' && data?.mentor_id) {

        // Atomic increment — safe because the guard above ensures this runs exactly once
        await supabase.rpc('increment_mentor_sessions', { p_mentor_id: data.mentor_id });

        // Credit wallet: move pending earnings → available balance
        const { error: walletError } = await supabase.rpc('complete_session_payment', {
          p_booking_id: bookingId,
          p_mentor_id:  data.mentor_id,
        });

        if (walletError) {
          console.error('❌ Failed to credit wallet:', walletError);
        }

        // If the mentor is on an activated Razorpay Route account, split
        // their cut to it now (fire-and-forget — wallet ledger above is
        // already correct either way, this just moves the real money).
        supabase.functions
          .invoke('transfer-session-payout', { body: { bookingId, mentorId: data.mentor_id } })
          .then(({ error: transferError }) => {
            if (transferError) console.warn('⚠️ transfer-session-payout failed:', transferError.message);
          })
          .catch(err => console.warn('⚠️ transfer-session-payout fetch error:', err));
      }

      // Notify learner of status change (fire-and-forget)
      const notifyUrl = `${SUPABASE_URL}/functions/v1/notify-booking-status`;
      fetch(notifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ bookingId, status }),
      })
        .then(async res => {
          if (!res.ok) {
            const text = await res.text().catch(() => '');
            console.warn('📣 notify-booking-status failed:', res.status, text);
          }
        })
        .catch(err => console.warn('📣 notify-booking-status fetch error:', err));

      return data;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  setMeetingId: async ({ bookingId, meetingId }) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ meeting_id: meetingId })
        .eq('id', bookingId);
      if (error) throw error;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  clearMeetingId: async bookingId => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ meeting_id: null })
        .eq('id', bookingId);
      if (error) throw error;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  getTransactionsAsMentor: async (mentorId) => {
    try {
      const [{ data, error }, { data: mentorProfile }] = await Promise.all([
        supabase
          .from('bookings')
          .select(`
            *,
            profiles:learner_id (id, name, avatar_url),
            availability_slots (date, start_time, end_time)
          `)
          .eq('mentor_id', mentorId)
          .order('created_at', { ascending: false }),
        supabase
          .from('mentor_profiles')
          .select('price_per_hour')
          .eq('id', mentorId)
          .single(),
      ]);

      if (error) throw error;
      const price = mentorProfile?.price_per_hour ?? null;
      const withRecs = await attachRecordings(data || []);
      return withRecs.map(b => ({ ...b, mentor_profiles: { price_per_hour: price } }));
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  getTransactionsAsLearner: async (learnerId) => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          profiles:mentor_id (id, name, avatar_url),
          availability_slots (date, start_time, end_time)
        `)
        .eq('learner_id', learnerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const rows = await attachRecordings(data || []);

      // Fetch price for each unique mentor in one query
      const mentorIds = [...new Set(rows.map(b => b.mentor_id).filter(Boolean))];
      let priceMap = {};
      if (mentorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('mentor_profiles')
          .select('id, price_per_hour')
          .in('id', mentorIds);
        (profiles || []).forEach(mp => { priceMap[mp.id] = mp.price_per_hour; });
      }

      return rows.map(b => ({
        ...b,
        mentor_profiles: { price_per_hour: priceMap[b.mentor_id] ?? null },
      }));
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  cancelBooking: async (bookingId) => {
    try {
      // Get the booking to find the slot
      const booking = await bookingApi.getBooking(bookingId);

      // Mark slot as available again
      await supabase
        .from('availability_slots')
        .update({ is_booked: false })
        .eq('id', booking.slot_id);

      // Update booking status
      const { data, error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId)
        .select()
        .single();

      if (error) throw error;

      // Cancel the scheduled reminder since booking is cancelled
      await cancelSessionReminder(bookingId).catch(() => {});

      return data;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },
};
