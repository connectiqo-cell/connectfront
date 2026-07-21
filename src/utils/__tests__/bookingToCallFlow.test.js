/**
 * Logical end-to-end flow: booking joinable → lobby → mentor starts room →
 * learner joins → active call → leave outcomes.
 *
 * Device/VideoSDK e2e is not available in this repo; this suite locks the
 * gatekeeping rules that previously blocked both roles from opening a call.
 */
import { isBookingSessionPast, isExpiredBooking } from '../bookingSession';
import { computeSessionTiming } from '../sessionSlotTimer';
import {
  getMainLobbyPanelType,
  getParticipantStatusText,
  shouldTransitionToExpiredOnSlotEnd,
} from '../sessionLobbyRules';
import { formatCountdown } from '../sessionSlotTimer';
import {
  MIN_SESSION_COMPLETE_SECONDS,
  resolveSessionEndOutcome,
} from '../sessionEndOutcome';
import {
  MEETING_LEAVE_IOS_NAV_DELAY_MS,
  scheduleMeetingLeaveNavigation,
} from '../meetingLeave';

function booking({
  date = '2026-06-13',
  start = '10:00',
  end = '10:30',
  status = 'confirmed',
  meeting_id = null,
} = {}) {
  return {
    id: 'booking-1',
    status,
    meeting_id,
    mentor_id: 'mentor-1',
    learner_id: 'learner-1',
    availability_slots: {
      date,
      start_time: start,
      end_time: end,
    },
  };
}

/** Mirrors CallsScreen / BookingsScreen: Join only when upcoming + pending/confirmed. */
function canShowJoinCta(row) {
  const isUpcoming = !isBookingSessionPast(row);
  const canJoin =
    isUpcoming && (row.status === 'pending' || row.status === 'confirmed');
  return canJoin;
}

/** Mirrors VideoCallScreen lobby readiness after mentor writes meeting_id. */
function applyLearnerMeetingUpdate(row, token = 'tok') {
  if (row?.meeting_id) {
    return {
      meetingReady: true,
      pendingCallParams: { token, meetingId: row.meeting_id },
    };
  }
  return { meetingReady: false, pendingCallParams: null };
}

/** Mirrors MeetingContainer: show call UI once local join succeeds. */
function shouldShowActiveCallUi({ isJoined, meetingType = 'ONE_TO_ONE' }) {
  if (!isJoined) return 'lobby_connecting';
  if (meetingType === 'GROUP') return 'conference';
  return 'one_to_one';
}

describe('booking → call → leave flow', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps Start/Join available from before start through the live window', () => {
    jest.useFakeTimers();
    const row = booking();

    jest.setSystemTime(new Date('2026-06-13T09:50:00'));
    expect(canShowJoinCta(row)).toBe(true);
    expect(computeSessionTiming(row.availability_slots).status).toBe('upcoming');
    expect(getMainLobbyPanelType('upcoming')).toBe('pre_start');

    // Critical regression: after start, still no meeting_id — both roles must Join/Start
    jest.setSystemTime(new Date('2026-06-13T10:10:00'));
    expect(isBookingSessionPast(row)).toBe(false);
    expect(canShowJoinCta(row)).toBe(true);
    expect(computeSessionTiming(row.availability_slots).status).toBe('live');
    expect(getMainLobbyPanelType('live')).toBe('no_show');
    expect(
      getParticipantStatusText({
        connecting: false,
        isSessionUpcoming: false,
        isSessionLive: true,
        untilStartSec: 0,
        remainingSec: 1200,
        otherLabel: 'mentor',
        formatCountdown,
      }),
    ).toBe('Slot is live · 20:00 remaining');
  });

  it('mentor start → learner ready → both enter active call UI', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-13T10:05:00'));

    let row = booking();
    expect(canShowJoinCta(row)).toBe(true);

    // Mentor creates VideoSDK room and persists meeting_id
    row = { ...row, meeting_id: 'room-abc' };
    expect(isBookingSessionPast(row)).toBe(false);

    const learner = applyLearnerMeetingUpdate(row);
    expect(learner.meetingReady).toBe(true);
    expect(learner.pendingCallParams).toEqual({
      token: 'tok',
      meetingId: 'room-abc',
    });

    // Learner cannot join before meeting_id exists
    expect(applyLearnerMeetingUpdate(booking()).meetingReady).toBe(false);

    // After VideoSDK join, call chrome opens even before remote peer arrives
    expect(shouldShowActiveCallUi({ isJoined: false })).toBe('lobby_connecting');
    expect(shouldShowActiveCallUi({ isJoined: true })).toBe('one_to_one');
  });

  it('leave before both join abandons and clears meeting_id for mentor', () => {
    const outcome = resolveSessionEndOutcome({
      bothJoinedAt: null,
      isMentorHost: true,
    });

    expect(outcome.kind).toBe('abandoned');
    expect(outcome.shouldClearMeetingId).toBe(true);
    expect(outcome.shouldMarkCompleted).toBe(false);
    expect(outcome.shouldStopRecording).toBe(true);

    // After clear, learner waits again
    const cleared = applyLearnerMeetingUpdate(booking({ meeting_id: null }));
    expect(cleared.meetingReady).toBe(false);
  });

  it('leave under 5 minutes does not complete the booking', () => {
    const bothJoinedAt = new Date('2026-06-13T10:05:00');
    const endedAt = new Date(bothJoinedAt.getTime() + 120_000); // 2 min

    const outcome = resolveSessionEndOutcome({
      bothJoinedAt,
      endedAt,
      isMentorHost: true,
    });

    expect(outcome.kind).toBe('too_short');
    expect(outcome.callDurationSec).toBe(120);
    expect(outcome.shouldMarkCompleted).toBe(false);
    expect(outcome.shouldClearMeetingId).toBe(false);
    expect(outcome.callDurationSec).toBeLessThan(MIN_SESSION_COMPLETE_SECONDS);
  });

  it('leave after 5+ minutes with both present completes for mentor', () => {
    const bothJoinedAt = new Date('2026-06-13T10:05:00');
    const endedAt = new Date(
      bothJoinedAt.getTime() + MIN_SESSION_COMPLETE_SECONDS * 1000,
    );

    const mentorOutcome = resolveSessionEndOutcome({
      bothJoinedAt,
      endedAt,
      isMentorHost: true,
    });
    expect(mentorOutcome.kind).toBe('completed');
    expect(mentorOutcome.shouldMarkCompleted).toBe(true);
    expect(mentorOutcome.shouldFetchRecording).toBe(true);
    expect(mentorOutcome.shouldClearMeetingId).toBe(false);

    const learnerOutcome = resolveSessionEndOutcome({
      bothJoinedAt,
      endedAt,
      isMentorHost: false,
    });
    expect(learnerOutcome.kind).toBe('completed');
    expect(learnerOutcome.shouldMarkCompleted).toBe(false);
    expect(learnerOutcome.shouldFetchRecording).toBe(false);
  });

  it('navigates away once on leave (android immediate, ios deferred)', () => {
    jest.useFakeTimers();
    const alreadyEndedRef = { current: false };
    const onNavigate = jest.fn();
    const timerRef = { current: null };

    expect(
      scheduleMeetingLeaveNavigation({
        alreadyEndedRef,
        onNavigate,
        platform: 'android',
      }),
    ).toBe(true);
    expect(onNavigate).toHaveBeenCalledTimes(1);

    // Second leave is ignored
    expect(
      scheduleMeetingLeaveNavigation({
        alreadyEndedRef,
        onNavigate,
        platform: 'android',
      }),
    ).toBe(false);
    expect(onNavigate).toHaveBeenCalledTimes(1);

    alreadyEndedRef.current = false;
    scheduleMeetingLeaveNavigation({
      alreadyEndedRef,
      onNavigate,
      platform: 'ios',
      timerRef,
    });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(MEETING_LEAVE_IOS_NAV_DELAY_MS);
    expect(onNavigate).toHaveBeenCalledTimes(2);
  });

  it('after slot end, booking leaves Upcoming and Join is removed', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-13T10:31:00'));

    const row = booking({ meeting_id: 'stale-room' });
    expect(isBookingSessionPast(row)).toBe(true);
    expect(canShowJoinCta(row)).toBe(false);
    expect(isExpiredBooking(row)).toBe(true);
    expect(computeSessionTiming(row.availability_slots).status).toBe('ended');
    expect(shouldTransitionToExpiredOnSlotEnd('ended', false)).toBe(true);
    expect(getMainLobbyPanelType('ended')).toBeNull();
  });
});
