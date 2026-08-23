import { supabase } from '../lib/supabase';

export const payoutApi = {
  /**
   * Saves the mentor's payout details for manual payouts — UPI ID and/or
   * bank account + IFSC. No Razorpay account is created.
   */
  createLinkedAccount: async ({ mentorId, upiId, bankAccount, ifsc, accountHolderName }) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-linked-account', {
        body: { mentorId, upiId, bankAccount, ifsc, accountHolderName },
      });
      if (error) throw new Error(error.message || 'Failed to save payout details');
      return data;
    } catch (error) {
      throw new Error(error.message || 'Failed to save payout details');
    }
  },

  getAccountStatus: async (mentorId) => {
    try {
      const { data, error } = await supabase.functions.invoke('get-account-status', {
        body: { mentorId },
      });
      if (error) throw new Error(error.message || 'Failed to fetch account status');
      return data;
    } catch (error) {
      throw new Error(error.message || 'Failed to fetch account status');
    }
  },
};
