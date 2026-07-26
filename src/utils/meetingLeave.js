/** Milliseconds to wait for VideoSDK onMeetingLeft before forcing navigation. */
export const MEETING_LEAVE_NAV_FALLBACK_MS = 1200;

/**
 * iOS delay before goBack after leave UI has replaced RTC views.
 * Needs enough time for WebRTC / MeetingProvider to detach without crashing.
 */
export const MEETING_LEAVE_IOS_NAV_DELAY_MS = 500;

/**
 * Schedule leave navigation once. Returns false if leave was already handled
 * (unless `force` is true — used when the user is stuck on the call screen).
 */
export function scheduleMeetingLeaveNavigation({
  alreadyEndedRef,
  onNavigate,
  iosNavDelayMs = MEETING_LEAVE_IOS_NAV_DELAY_MS,
  platform,
  timerRef,
  force = false,
}) {
  if (alreadyEndedRef.current && !force) {
    return false;
  }
  alreadyEndedRef.current = true;

  const run = () => {
    if (timerRef?.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onNavigate();
  };

  if (timerRef?.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  if (platform === 'ios') {
    timerRef.current = setTimeout(run, iosNavDelayMs);
  } else {
    run();
  }

  return true;
}
