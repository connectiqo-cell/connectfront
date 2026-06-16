export function pad2(n) {
  return String(Math.max(0, n)).padStart(2, '0');
}

export function formatCountdown(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  return `${pad2(m)}:${pad2(s)}`;
}

export function getSlotStartMs(dateStr, startTime) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [sh, sm] = (startTime || '00:00').substring(0, 5).split(':').map(Number);
  return new Date(y, m - 1, d, sh, sm, 0).getTime();
}

export function getSlotEndMs(dateStr, endTime) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [eh, em] = (endTime || '23:59').substring(0, 5).split(':').map(Number);
  return new Date(y, m - 1, d, eh, em, 0).getTime();
}

export function slotDurationMinutes(start, end) {
  if (!start || !end) return 30;
  const [sh, sm] = start.substring(0, 5).split(':').map(Number);
  const [eh, em] = end.substring(0, 5).split(':').map(Number);
  return Math.max(1, eh * 60 + em - (sh * 60 + sm));
}

/** @returns {{ status: 'upcoming'|'live'|'ended', remainingSec, untilStartSec, elapsedSec, totalSec }} */
export function computeSessionTiming(slot = {}) {
  const startMs = getSlotStartMs(slot.date, slot.start_time);
  const endMs = getSlotEndMs(slot.date, slot.end_time);
  const now = Date.now();

  if (!startMs || !endMs) {
    return {
      status: 'live',
      remainingSec: 0,
      untilStartSec: 0,
      elapsedSec: 0,
      totalSec: 0,
    };
  }

  const totalSec = Math.max(1, Math.floor((endMs - startMs) / 1000));

  if (now < startMs) {
    return {
      status: 'upcoming',
      remainingSec: Math.floor((endMs - now) / 1000),
      untilStartSec: Math.floor((startMs - now) / 1000),
      elapsedSec: 0,
      totalSec,
    };
  }

  if (now >= endMs) {
    return {
      status: 'ended',
      remainingSec: 0,
      untilStartSec: 0,
      elapsedSec: totalSec,
      totalSec,
    };
  }

  return {
    status: 'live',
    remainingSec: Math.floor((endMs - now) / 1000),
    untilStartSec: 0,
    elapsedSec: Math.floor((now - startMs) / 1000),
    totalSec,
  };
}
