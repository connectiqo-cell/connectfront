import { supabase } from '../lib/supabase';
import { getSupabaseErrorMessage } from '../lib/supabaseErrorHandler';

async function invokeFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // On non-2xx, data is null — the real error body is in error.context (Response)
    let detail = error.message;
    try {
      const body = await error.context?.json?.();
      if (body?.error) detail = body.error;
    } catch (_) { /* ignore parse failure */ }
    throw new Error(detail);
  }
  return data;
}

/** Fire-and-forget: push the mentor as soon as a session is booked. */
function notifyMentorNewBooking(bookingId) {
  if (!bookingId) return;
  supabase.functions
    .invoke('notify-new-booking', { body: { bookingId } })
    .then(({ data, error }) => {
      if (error) {
        console.warn('📣 notify-new-booking failed:', error.message);
        return;
      }
      if (data?.skipped) {
        console.warn('📣 notify-new-booking skipped:', data.reason);
        return;
      }
      console.log('📣 notify-new-booking ok');
    })
    .catch((err) => console.warn('📣 notify-new-booking error:', err));
}

export const paymentApi = {
  /**
   * Step 1: Create a Razorpay order via Supabase Edge Function.
   * Accepts slotId (legacy) and/or slotIds (multi-slot same-day).
   * Returns { orderId, amount, currency, keyId }
   */
  createOrder: async ({ mentorId, learnerId, slotId, slotIds, message, recordingRequested }) => {
    try {
      const ids = Array.isArray(slotIds) && slotIds.length
        ? slotIds
        : slotId
          ? [slotId]
          : [];
      return await invokeFunction('create-razorpay-order', {
        mentorId,
        learnerId,
        slotId: ids[0],
        slotIds: ids,
        message,
        recordingRequested,
      });
    } catch (error) {
      console.error('💳 createOrder error:', error?.message);
      throw new Error(error?.message || 'Failed to create order');
    }
  },

  /**
   * Step 2: Verify payment + create booking(s) atomically via Edge Function.
   * Called after Razorpay checkout returns success.
   * Returns { success: true, bookingId, bookingIds }
   */
  verifyAndBook: async ({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    mentorId,
    learnerId,
    slotId,
    slotIds,
    message,
    recordingRequested,
  }) => {
    try {
      const ids = Array.isArray(slotIds) && slotIds.length
        ? slotIds
        : slotId
          ? [slotId]
          : [];
      return await invokeFunction('verify-razorpay-payment', {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        mentorId,
        learnerId,
        slotId: ids[0],
        slotIds: ids,
        message,
        recordingRequested,
      }).then((result) => {
        const bookingId =
          result?.bookingId ||
          (Array.isArray(result?.bookingIds) ? result.bookingIds[0] : null);
        // Immediately ping mentor — do not wait for verify-edge FCM alone.
        notifyMentorNewBooking(bookingId);
        return result;
      });
    } catch (error) {
      console.error('💳 verifyAndBook error:', error?.message);
      throw new Error(error?.message || 'Payment verification failed');
    }
  },

  /**
   * Get sum of pending earnings (paid but session not yet completed).
   */
  getPendingEarnings: async (mentorId) => {
    try {
      const { data, error } = await supabase
        .from('earnings')
        .select('amount')
        .eq('mentor_id', mentorId)
        .eq('status', 'pending');

      if (error) throw error;
      return (data || []).reduce((sum, row) => sum + parseFloat(row.amount || 0), 0);
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  /**
   * Get mentor's wallet balance.
   */
  getWallet: async (mentorId) => {
    try {
      const { data, error } = await supabase
        .from('mentor_wallets')
        .select('balance, total_earned, total_withdrawn')
        .eq('id', mentorId)
        .maybeSingle();

      if (error) throw error;
      return data || { balance: 0, total_earned: 0, total_withdrawn: 0 };
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  /**
   * Get all transactions for a user (as mentor or learner).
   */
  getTransactions: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, status, created_at, learner_id, mentor_id, razorpay_order_id, razorpay_payment_id, amount_total_paise, platform_fee_paise, mentor_earning_paise')
        .or(`learner_id.eq.${userId},mentor_id.eq.${userId}`)
        .eq('status', 'paid')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  /**
   * Create a manual withdrawal request for admin fulfilment — an operator
   * settles it via UPI/IMPS/NEFT and records the UTR. Not a RazorpayX payout.
   */
  requestWithdrawal: async ({ mentorId, amount }) => {
    try {
      return await invokeFunction('process-withdrawal', { mentorId, amount });
    } catch (error) {
      throw new Error(error.message || 'Withdrawal failed');
    }
  },

  /**
   * List this mentor's withdrawal requests, most recent first.
   */
  getWithdrawalRequests: async (mentorId) => {
    try {
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select('id, amount, upi_id, status, payout_method, payout_reference, paid_at, rejected_reason, created_at')
        .eq('mentor_id', mentorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  /**
   * Resolve fee/GST rule for the platform.
   */
  getFeeRule: async () => {
    try {
      const { data, error } = await supabase
        .from('platform_fee_rules')
        .select('platform_fee_percent, gst_percent')
        .eq('is_active', true)
        .single();

      if (error) throw error;
      return data || null;
    } catch (error) {
      console.warn('⚠️ Fee rule lookup failed, using defaults:', error?.message);
      return null;
    }
  },
};
