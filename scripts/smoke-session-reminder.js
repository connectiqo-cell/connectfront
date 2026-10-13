/**
 * Smoke checks for session reminder window math (mirrors notify-session-reminders).
 * Run: node scripts/smoke-session-reminder.js
 */

const REMINDER_MINUTES = 15;
const WINDOW_BEFORE_MIN = 16;
const WINDOW_AFTER_MIN = 13;

function sessionStartMs(date, startTime) {
  const time = String(startTime).slice(0, 8);
  const iso = `${date}T${time}+05:30`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function isInReminderWindow(sessionMs, nowMs) {
  const minsUntil = (sessionMs - nowMs) / 60000;
  return minsUntil <= WINDOW_BEFORE_MIN && minsUntil >= WINDOW_AFTER_MIN;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Fixed "now": 2026-09-13 10:00 IST
const nowMs = Date.parse('2026-09-13T10:00:00+05:30');

// Session at 10:15 IST → exactly 15 min away → due
const dueStart = sessionStartMs('2026-09-13', '10:15:00');
assert(dueStart != null, 'parse due start');
assert(isInReminderWindow(dueStart, nowMs), '10:15 should be in window at 10:00');

// Session at 10:30 → 30 min away → not due
const later = sessionStartMs('2026-09-13', '10:30:00');
assert(!isInReminderWindow(later, nowMs), '10:30 should be outside window');

// Session at 10:14 → 14 min away → still in window (>= 13)
const almost = sessionStartMs('2026-09-13', '10:14:00');
assert(isInReminderWindow(almost, nowMs), '10:14 should be in window');

// Session at 10:12 → 12 min away → too close
const tooClose = sessionStartMs('2026-09-13', '10:12:00');
assert(!isInReminderWindow(tooClose, nowMs), '10:12 should be outside window');

console.log('smoke-session-reminder: OK');
console.log(`  reminder target: ${REMINDER_MINUTES} min before start (IST)`);
console.log(`  cron window: ${WINDOW_AFTER_MIN}–${WINDOW_BEFORE_MIN} min before start`);
