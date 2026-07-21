/** True when the booked slot has ended (Join/Start no longer available). */
export function isBookingSessionPast(booking) {
  const date = booking?.availability_slots?.date;
  if (!date) return false;

  const startTime = booking?.availability_slots?.start_time;
  const endTime = booking?.availability_slots?.end_time;
  const now = new Date();

  if (startTime) {
    const startDt = new Date(`${date}T${startTime}`);

    // Not started yet — always upcoming
    if (startDt > now) return false;

    // Start time has passed. Check end_time first.
    if (endTime) {
      const endDt = new Date(`${date}T${endTime}`);
      // Past end_time — always expired (even if meeting_id is stale)
      if (endDt < now) return true;
      // Within the scheduled window — keep Join/Start so mentor can create the room
      return false;
    }

    // No end_time: allow joining for up to 2 hours after start
    const cutoff = new Date(startDt);
    cutoff.setHours(cutoff.getHours() + 2);
    return cutoff < now;
  }

  if (endTime) {
    return new Date(`${date}T${endTime}`) < now;
  }

  return new Date(`${date}T23:59:59`) < now;
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
