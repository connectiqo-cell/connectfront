import {
  MEETING_LEAVE_IOS_NAV_DELAY_MS,
  MEETING_LEAVE_NAV_FALLBACK_MS,
  scheduleMeetingLeaveNavigation,
} from '../meetingLeave';

describe('meetingLeave', () => {
  describe('scheduleMeetingLeaveNavigation', () => {
    it('runs onNavigate immediately on android', () => {
      const alreadyEndedRef = { current: false };
      const onNavigate = jest.fn();

      const result = scheduleMeetingLeaveNavigation({
        alreadyEndedRef,
        onNavigate,
        platform: 'android',
      });

      expect(result).toBe(true);
      expect(alreadyEndedRef.current).toBe(true);
      expect(onNavigate).toHaveBeenCalledTimes(1);
    });

    it('defers onNavigate on ios', () => {
      jest.useFakeTimers();
      const alreadyEndedRef = { current: false };
      const onNavigate = jest.fn();
      const timerRef = { current: null };

      scheduleMeetingLeaveNavigation({
        alreadyEndedRef,
        onNavigate,
        platform: 'ios',
        timerRef,
      });

      expect(onNavigate).not.toHaveBeenCalled();
      jest.advanceTimersByTime(MEETING_LEAVE_IOS_NAV_DELAY_MS);
      expect(onNavigate).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
    });

    it('returns false when leave already handled', () => {
      const alreadyEndedRef = { current: true };
      const onNavigate = jest.fn();

      const result = scheduleMeetingLeaveNavigation({
        alreadyEndedRef,
        onNavigate,
        platform: 'android',
      });

      expect(result).toBe(false);
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it('allows force navigation when already ended', () => {
      jest.useFakeTimers();
      const alreadyEndedRef = { current: true };
      const onNavigate = jest.fn();
      const timerRef = { current: null };

      const result = scheduleMeetingLeaveNavigation({
        alreadyEndedRef,
        onNavigate,
        platform: 'ios',
        timerRef,
        force: true,
      });

      expect(result).toBe(true);
      jest.advanceTimersByTime(MEETING_LEAVE_IOS_NAV_DELAY_MS);
      expect(onNavigate).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
    });
  });

  it('exports sensible fallback timing', () => {
    expect(MEETING_LEAVE_NAV_FALLBACK_MS).toBeGreaterThan(MEETING_LEAVE_IOS_NAV_DELAY_MS);
  });
});
