import { supabase } from '../lib/supabase';
import { getSupabaseErrorMessage } from '../lib/supabaseErrorHandler';

const normalizeTime = time => (time ? String(time).substring(0, 5) : '');

const slotIdentityKey = (date, startTime, endTime) =>
  `${date}|${normalizeTime(startTime)}|${normalizeTime(endTime)}`;

const timeKey = (startTime, endTime) =>
  `${normalizeTime(startTime)}-${normalizeTime(endTime)}`;

const collectProtectedIds = (bookings = [], txns = []) =>
  new Set([
    ...(bookings || []).flatMap(row => [
      row.slot_id,
      ...(Array.isArray(row.slot_ids) ? row.slot_ids : []),
    ]),
    ...(txns || []).flatMap(row => [
      row.slot_id,
      ...(Array.isArray(row.slot_ids) ? row.slot_ids : []),
    ]),
  ]);

export const availabilityApi = {
  getAvailabilityForMentor: async (mentorId, { bookableOnly = false } = {}) => {
    try {
      let query = supabase
        .from('availability_slots')
        .select('id, date, start_time, end_time, is_booked')
        .eq('mentor_id', mentorId)
        .order('date', { ascending: true });

      if (bookableOnly) {
        query = query.eq('is_booked', false);
      }

      const { data, error } = await query;

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
            .select('slot_id, slot_ids')
            .eq('mentor_id', mentorId)
            .not('slot_id', 'is', null),
        ]);

      if (fetchError) throw fetchError;
      if (bookingsError) throw bookingsError;

      const protectedIds = new Set(
        (bookings || []).flatMap(row => [
          row.slot_id,
          ...(Array.isArray(row.slot_ids) ? row.slot_ids : []),
        ]),
      );
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
            .select('slot_id, slot_ids')
            .eq('mentor_id', mentorId)
            .not('slot_id', 'is', null),
          // transactions also holds slot_id / slot_ids — must protect those too
          supabase
            .from('transactions')
            .select('slot_id, slot_ids')
            .not('slot_id', 'is', null),
        ]);

      if (fetchError) throw fetchError;
      if (bookingsError) throw bookingsError;
      if (txnsError) throw txnsError;

      const protectedIds = new Set([
        ...(bookings || []).flatMap(row => [
          row.slot_id,
          ...(Array.isArray(row.slot_ids) ? row.slot_ids : []),
        ]),
        ...(txns || []).flatMap(row => [
          row.slot_id,
          ...(Array.isArray(row.slot_ids) ? row.slot_ids : []),
        ]),
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

      const todayStr = (() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      })();

      const idsToDelete = (existing || [])
        .filter(slot => {
          if (slot.is_booked) return false;
          if (protectedIds.has(slot.id)) return false;
          // Keep past days so schedule history is not wiped on publish.
          if (slot.date < todayStr) return false;
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

  /**
   * Publishes one date's open slots to match `desired` exactly (web portal Schedule).
   * Inserts missing start/end pairs and deletes unbooked future slots that were
   * unselected. Booked, protected, and already-past slots are never deleted.
   */
  syncSlotsForDate: async ({ mentorId, date, existing = [], desired = [] }) => {
    try {
      const [
        { data: bookings, error: bookingsError },
        { data: txns, error: txnsError },
      ] = await Promise.all([
        supabase
          .from('bookings')
          .select('slot_id, slot_ids')
          .eq('mentor_id', mentorId)
          .not('slot_id', 'is', null),
        supabase.from('transactions').select('slot_id, slot_ids').not('slot_id', 'is', null),
      ]);

      if (bookingsError) throw bookingsError;
      if (txnsError) throw txnsError;

      const protectedIds = collectProtectedIds(bookings, txns);
      const desiredKeys = new Set(
        desired.map(d => timeKey(d.startTime, d.endTime)),
      );
      const existingUnbooked = (existing || []).filter(s => !s.is_booked);
      const existingKeys = new Set(
        existingUnbooked.map(s => timeKey(s.start_time, s.end_time)),
      );

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const isSlotDue = (slotDate, startTime) => {
        const start = normalizeTime(startTime);
        if (!slotDate || !start) return true;
        if (slotDate < todayStr) return true;
        if (slotDate > todayStr) return false;
        const [hours, mins] = start.split(':').map(Number);
        if (Number.isNaN(hours) || Number.isNaN(mins)) return true;
        const slotTime = new Date(now);
        slotTime.setHours(hours, mins, 0, 0);
        return slotTime.getTime() <= now.getTime();
      };

      const toDelete = existingUnbooked.filter(s => {
        if (protectedIds.has(s.id)) return false;
        if (isSlotDue(s.date || date, s.start_time)) return false;
        return !desiredKeys.has(timeKey(s.start_time, s.end_time));
      });
      const toInsert = desired.filter(
        d => !existingKeys.has(timeKey(d.startTime, d.endTime)),
      );

      if (toDelete.length) {
        const { error } = await supabase
          .from('availability_slots')
          .delete()
          .in(
            'id',
            toDelete.map(s => s.id),
          )
          .eq('is_booked', false);
        if (error) throw error;
      }

      if (toInsert.length) {
        const { error } = await supabase.from('availability_slots').insert(
          toInsert.map(d => ({
            mentor_id: mentorId,
            date,
            start_time: normalizeTime(d.startTime),
            end_time: normalizeTime(d.endTime),
            is_booked: false,
          })),
        );
        if (error) throw error;
      }
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
