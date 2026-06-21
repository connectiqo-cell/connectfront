import { supabase } from '../lib/supabase';
import { getSupabaseErrorMessage } from '../lib/supabaseErrorHandler';

const normalizeTime = time => (time ? String(time).substring(0, 5) : '');

const slotIdentityKey = (date, startTime, endTime) =>
  `${date}|${normalizeTime(startTime)}|${normalizeTime(endTime)}`;

export const availabilityApi = {
  getAvailabilityForMentor: async (mentorId) => {
    try {
      const { data, error } = await supabase
        .from('availability_slots')
        .select('id, date, start_time, end_time, is_booked')
        .eq('mentor_id', mentorId)
        .order('date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  getAvailableSlots: async ({ mentorId, date }) => {
    try {
      const { data, error } = await supabase
        .from('availability_slots')
        .select('id, date, start_time, end_time')
        .eq('mentor_id', mentorId)
        .eq('date', date)
        .eq('is_booked', false)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  addAvailabilitySlot: async ({ mentorId, date, startTime, endTime }) => {
    try {
      const { data, error } = await supabase
        .from('availability_slots')
        .insert([
          {
            mentor_id: mentorId,
            date,
            start_time: startTime,
            end_time: endTime,
            is_booked: false,
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

  deleteAvailabilitySlot: async (mentorId) => {
    try {
      const [{ data: existing, error: fetchError }, { data: bookings, error: bookingsError }] =
        await Promise.all([
          supabase
            .from('availability_slots')
            .select('id, is_booked')
            .eq('mentor_id', mentorId)
            .eq('is_booked', false),
          supabase
            .from('bookings')
            .select('slot_id')
            .eq('mentor_id', mentorId)
            .not('slot_id', 'is', null),
        ]);

      if (fetchError) throw fetchError;
      if (bookingsError) throw bookingsError;

      const protectedIds = new Set((bookings || []).map(row => row.slot_id));
      const idsToDelete = (existing || [])
        .filter(slot => !protectedIds.has(slot.id))
        .map(slot => slot.id);

      if (!idsToDelete.length) return;

      const { error } = await supabase.from('availability_slots').delete().in('id', idsToDelete);
      if (error) throw error;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  syncMentorAvailability: async (mentorId, slotEntries = []) => {
    try {
      const [
        { data: existing, error: fetchError },
        { data: bookings, error: bookingsError },
        { data: txns, error: txnsError },
      ] = await Promise.all([
          supabase
            .from('availability_slots')
            .select('id, date, start_time, end_time, is_booked')
            .eq('mentor_id', mentorId),
          supabase
            .from('bookings')
            .select('slot_id')
            .eq('mentor_id', mentorId)
            .not('slot_id', 'is', null),
          // transactions also holds a slot_id FK — must protect those too
          supabase
            .from('transactions')
            .select('slot_id')
            .not('slot_id', 'is', null),
        ]);

      if (fetchError) throw fetchError;
      if (bookingsError) throw bookingsError;
      if (txnsError) throw txnsError;

      const protectedIds = new Set([
        ...(bookings || []).map(row => row.slot_id),
        ...(txns || []).map(row => row.slot_id),
      ]);
      const desiredKeys = new Set(
        slotEntries.map(entry =>
          slotIdentityKey(entry.date, entry.startTime, entry.endTime),
        ),
      );

      const existingByKey = new Map();
      (existing || []).forEach(slot => {
        existingByKey.set(
          slotIdentityKey(slot.date, slot.start_time, slot.end_time),
          slot,
        );
      });

      const idsToDelete = (existing || [])
        .filter(slot => {
          if (slot.is_booked) return false;
          if (protectedIds.has(slot.id)) return false;
          const key = slotIdentityKey(slot.date, slot.start_time, slot.end_time);
          return !desiredKeys.has(key);
        })
        .map(slot => slot.id);

      if (idsToDelete.length) {
        const DELETE_BATCH = 100;
        for (let i = 0; i < idsToDelete.length; i += DELETE_BATCH) {
          const chunk = idsToDelete.slice(i, i + DELETE_BATCH);
          const { error: deleteError } = await supabase
            .from('availability_slots')
            .delete()
            .in('id', chunk);
          if (deleteError) throw deleteError;
        }
      }

      const rowsToInsert = slotEntries
        .filter(entry => {
          const key = slotIdentityKey(entry.date, entry.startTime, entry.endTime);
          return !existingByKey.has(key);
        })
        .map(({ date, startTime, endTime }) => ({
          mentor_id: mentorId,
          date,
          start_time: startTime,
          end_time: endTime,
          is_booked: false,
        }));

      if (!rowsToInsert.length) return 0;

      const BATCH_SIZE = 100;
      for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
        const chunk = rowsToInsert.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('availability_slots').insert(chunk);
        if (error) throw error;
      }

      return rowsToInsert.length;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  markSlotBooked: async (slotId) => {
    try {
      const { error } = await supabase
        .from('availability_slots')
        .update({ is_booked: true })
        .eq('id', slotId);

      if (error) throw error;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  markSlotAvailable: async (slotId) => {
    try {
      const { error } = await supabase
        .from('availability_slots')
        .update({ is_booked: false })
        .eq('id', slotId);

      if (error) throw error;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },
};
