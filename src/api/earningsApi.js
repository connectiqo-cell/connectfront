import { supabase } from '../lib/supabase';
import { getSupabaseErrorMessage } from '../lib/supabaseErrorHandler';

const toDateStr = d => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const earningsApi = {
  getEarningsByMentor: async (mentorId) => {
    try {
      const { data, error } = await supabase
        .from('earnings')
        .select(`
          *,
          bookings (
            id,
            learner_id,
            created_at,
            profiles!learner_id (
              name
            )
          )
        `)
        .eq('mentor_id', mentorId)
        .neq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  getEarningsByWeek: async (mentorId) => {
    try {
      const today = new Date();
      const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
      const startStr = toDateStr(weekStart);

      const { data, error } = await supabase
        .from('earnings')
        .select('amount, created_at')
        .eq('mentor_id', mentorId)
        .neq('status', 'pending')
        .gte('created_at', startStr);

      if (error) throw error;

      const grouped = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        grouped[toDateStr(d)] = 0;
      }
      (data || []).forEach(earning => {
        const day = String(earning.created_at).split('T')[0];
        if (day in grouped) grouped[day] += parseFloat(earning.amount);
      });

      return Object.entries(grouped).map(([date, amount]) => ({ date, amount }));
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  getEarningsByMonth: async (mentorId) => {
    try {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 27);
      const startStr = toDateStr(start);

      const { data, error } = await supabase
        .from('earnings')
        .select('amount, created_at')
        .eq('mentor_id', mentorId)
        .neq('status', 'pending')
        .gte('created_at', startStr);

      if (error) throw error;

      const grouped = {};
      (data || []).forEach(earning => {
        const date = new Date(earning.created_at);
        const weekNum = Math.min(4, Math.ceil(date.getDate() / 7));
        const key = `Week ${weekNum}`;
        grouped[key] = (grouped[key] || 0) + parseFloat(earning.amount);
      });

      return [1, 2, 3, 4].map(n => ({
        week: `Week ${n}`,
        amount: grouped[`Week ${n}`] || 0,
      }));
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  getEarningsByYear: async (mentorId) => {
    try {
      const year = new Date().getFullYear();
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year + 1}-01-01`;

      const { data, error } = await supabase
        .from('earnings')
        .select('amount, created_at')
        .eq('mentor_id', mentorId)
        .neq('status', 'pending')
        .gte('created_at', yearStart)
        .lt('created_at', yearEnd);

      if (error) throw error;

      const months = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];
      const grouped = Object.fromEntries(months.map(m => [m, 0]));

      (data || []).forEach(earning => {
        const date = new Date(earning.created_at);
        const monthName = months[date.getMonth()];
        grouped[monthName] = (grouped[monthName] || 0) + parseFloat(earning.amount);
      });

      return months.map(month => ({ month, amount: grouped[month] || 0 }));
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  getTotalEarnings: async (mentorId) => {
    try {
      const { data, error } = await supabase
        .from('earnings')
        .select('amount')
        .eq('mentor_id', mentorId)
        .eq('status', 'completed');

      if (error) throw error;

      const total = (data || []).reduce(
        (sum, earning) => sum + parseFloat(earning.amount),
        0
      );

      return total;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  createEarning: async ({ mentorId, bookingId, amount }) => {
    try {
      const { data, error } = await supabase
        .from('earnings')
        .insert([
          {
            mentor_id: mentorId,
            booking_id: bookingId,
            amount,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },
};
