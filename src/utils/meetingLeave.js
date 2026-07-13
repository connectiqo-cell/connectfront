/** Milliseconds to wait for VideoSDK onMeetingLeft before forcing navigation. */
export const MEETING_LEAVE_NAV_FALLBACK_MS = 1000;

/** iOS delay before goBack so WebRTC views can detach without crashing. */
export const MEETING_LEAVE_IOS_NAV_DELAY_MS = 200;

/**
 * Schedule leave navigation once. Returns false if leave was already handled.
 */
export function scheduleMeetingLeaveNavigation({
  alreadyEndedRef,
  onNavigate,
  iosNavDelayMs = MEETING_LEAVE_IOS_NAV_DELAY_MS,
  platform,
  timerRef,
}) {
  if (alreadyEndedRef.current) {
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
  }

  if (platform === 'ios') {
    timerRef.current = setTimeout(run, iosNavDelayMs);
  } else {
    run();
  }

  return true;
}
