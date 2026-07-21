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

export const paymentApi = {
  /**
   * Step 1: Create a Razorpay order via Supabase Edge Function.
   * Returns { orderId, amount, currency, keyId }
   */
  createOrder: async ({ mentorId, learnerId, slotId, message, recordingRequested }) => {
    try {
      return await invokeFunction('create-razorpay-order', {
        mentorId,
        learnerId,
        slotId,
        message,
        recordingRequested,
      });
    } catch (error) {
      console.error('💳 createOrder error:', error?.message);
      throw new Error(error?.message || 'Failed to create order');
    }
  },

  /**
   * Step 2: Verify payment + create booking atomically via Edge Function.
   * Called after Razorpay checkout returns success.
   * Returns { success: true, bookingId }
   */
  verifyAndBook: async ({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    mentorId,
    learnerId,
    slotId,
    message,
    recordingRequested,
  }) => {
    try {
      return await invokeFunction('verify-razorpay-payment', {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        mentorId,
        learnerId,
        slotId,
        message,
        recordingRequested,
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
   * Trigger a RazorpayX UPI payout via Edge Function.
   */
  requestWithdrawal: async ({ mentorId, amount }) => {
    try {
      return await invokeFunction('process-withdrawal', { mentorId, amount });
    } catch (error) {
      throw new Error(error.message || 'Withdrawal failed');
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
