/** Normalize HH:MM:SS or HH:MM to HH:MM for comparisons. */
export function normalizeSlotTime(time) {
  if (!time) return '';
  return String(time).substring(0, 5);
}

/** True when sorted slots form one continuous block (each end equals next start). */
export function areSlotsContiguous(slots = []) {
  if (!slots.length) return true;
  if (slots.length === 1) return true;
  const sorted = [...slots].sort((a, b) =>
    normalizeSlotTime(a.start_time).localeCompare(normalizeSlotTime(b.start_time)),
  );
  for (let i = 0; i < sorted.length - 1; i += 1) {
    if (normalizeSlotTime(sorted[i].end_time) !== normalizeSlotTime(sorted[i + 1].start_time)) {
      return false;
    }
  }
  return true;
}

/** Same-day contiguous check for server/client slot rows. */
export function assertContiguousSameDay(slots = []) {
  if (!slots.length) {
    throw new Error('No slots selected');
  }
  const date = slots[0].date;
  for (const slot of slots) {
    if (date != null && slot.date != null && slot.date !== date) {
      throw new Error('All selected slots must be on the same day');
    }
  }
  if (!areSlotsContiguous(slots)) {
    throw new Error('Selected slots must be continuous back-to-back times');
  }
  return [...slots].sort((a, b) =>
    normalizeSlotTime(a.start_time).localeCompare(normalizeSlotTime(b.start_time)),
  );
}
