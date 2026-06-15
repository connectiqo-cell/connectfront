/** True when the booked slot end time is in the past. */
export function isBookingSessionPast(booking) {
  const date = booking?.availability_slots?.date;
  const endTime = booking?.availability_slots?.end_time;
  if (!date) return false;
  return new Date(`${date}T${endTime || '23:59:59'}`) < new Date();
}

/** Pending/confirmed booking whose slot ended without completion. */
export function isExpiredBooking(booking) {
  if (!isBookingSessionPast(booking)) return false;
  const status = (booking?.status || '').toLowerCase();
  if (status === 'completed' || status === 'cancelled' || status === 'rejected') {
    return false;
  }
  return status === 'pending' || status === 'confirmed';
}
