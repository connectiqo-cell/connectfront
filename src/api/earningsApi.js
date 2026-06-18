import { supabase } from '../lib/supabase';
import { getSupabaseErrorMessage } from '../lib/supabaseErrorHandler';

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
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const startStr = weekStart.toISOString().split('T')[0];
      const endStr = weekEnd.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('earnings')
        .select('amount, created_at')
        .eq('mentor_id', mentorId)
        .neq('status', 'pending')
        .gte('created_at', startStr)
        .lt('created_at', endStr);

      if (error) throw error;

      // Group by day
      const grouped = {};
      (data || []).forEach(earning => {
        const day = earning.created_at.split('T')[0];
        grouped[day] = (grouped[day] || 0) + parseFloat(earning.amount);
      });

      return Object.entries(grouped).map(([date, amount]) => ({ date, amount }));
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  getEarningsByMonth: async (mentorId) => {
    try {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;

      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

      const { data, error } = await supabase
        .from('earnings')
        .select('amount, created_at')
        .eq('mentor_id', mentorId)
        .neq('status', 'pending')
        .gte('created_at', monthStart)
        .lt('created_at', monthEnd);

      if (error) throw error;

      // Group by week
      const grouped = {};
      (data || []).forEach(earning => {
        const date = new Date(earning.created_at);
        const weekNum = Math.ceil((date.getDate()) / 7);
        const key = `Week ${weekNum}`;
        grouped[key] = (grouped[key] || 0) + parseFloat(earning.amount);
      });

      return Object.entries(grouped).map(([week, amount]) => ({ week, amount }));
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

      // Group by month
      const grouped = {};
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

      (data || []).forEach(earning => {
        const date = new Date(earning.created_at);
        const monthName = months[date.getMonth()];
        grouped[monthName] = (grouped[monthName] || 0) + parseFloat(earning.amount);
      });

      return Object.entries(grouped).map(([month, amount]) => ({ month, amount }));
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
