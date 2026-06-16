import { supabase } from '../lib/supabase';
import { getSupabaseErrorMessage } from '../lib/supabaseErrorHandler';

export const reviewsApi = {
  submitReview: async ({ bookingId, mentorId, learnerId, rating, comment }) => {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .insert({ booking_id: bookingId, mentor_id: mentorId, learner_id: learnerId, rating, comment: comment || null })
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  getReviewForBooking: async (bookingId) => {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, rating, comment')
        .eq('booking_id', bookingId)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  /** Single query for which bookings already have a review. */
  getReviewedBookingIds: async (bookingIds = []) => {
    if (!bookingIds.length) return new Set();
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('booking_id')
        .in('booking_id', bookingIds);
      if (error) throw error;
      return new Set((data || []).map(r => r.booking_id));
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  getReviewsForMentor: async (mentorId) => {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`*, profiles!learner_id (name, avatar_url)`)
        .eq('mentor_id', mentorId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },
};
