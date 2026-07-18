import { supabase } from '../lib/supabase';

export const payoutApi = {
  createLinkedAccount: async ({ mentorId, legalName, phone, addressLine1, city, state, postalCode, upiId }) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-linked-account', {
        body: { mentorId, legalName, phone, addressLine1, city, state, postalCode, upiId },
      });
      if (error) throw new Error(error.message || 'Failed to create payout account');
      return data;
    } catch (error) {
      throw new Error(error.message || 'Failed to create payout account');
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
