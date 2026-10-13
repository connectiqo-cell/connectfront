import { supabase } from '../lib/supabase';
import { getSupabaseErrorMessage } from '../lib/supabaseErrorHandler';

/** Recalc mentor avg rating via shared edge function (web + mobile). */
async function recalculateMentorRating(mentorId) {
  if (!mentorId) return null;
  const { data, error } = await supabase.functions.invoke('recalculate-mentor-rating', {
    body: { mentorId },
  });
  if (error) {
    let detail = error.message;
    try {
      const body = await error.context?.json?.();
      if (body?.error) detail = body.error;
    } catch (_) { /* ignore */ }
    throw new Error(detail);
  }
  return data;
}

export const reviewsApi = {
  submitReview: async ({ bookingId, mentorId, learnerId, rating, comment }) => {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .insert({ booking_id: bookingId, mentor_id: mentorId, learner_id: learnerId, rating, comment: comment || null })
        .select()
        .single();
      if (error) throw error;

      // Keep mentor_profiles.rating in sync with all reviews (shared with web).
      try {
        const recalc = await recalculateMentorRating(mentorId);
        return {
          ...data,
          mentorRating: recalc?.rating,
          reviewCount: recalc?.reviewCount,
        };
      } catch (recalcErr) {
        console.warn(
          'recalculate-mentor-rating failed:',
          recalcErr?.message || recalcErr,
        );
        return data;
      }
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
