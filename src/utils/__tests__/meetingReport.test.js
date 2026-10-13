import { resolveMeetingReportTarget } from '../meetingReport';

describe('resolveMeetingReportTarget', () => {
  const booking = {
    id: 'booking-1',
    mentor_id: 'mentor-1',
    learner_id: 'learner-1',
    profiles: { name: 'Learner Name' },
    mentor_profile: { name: 'Mentor Name' },
  };

  it('resolves learner as target when mentor is signed in', () => {
    expect(
      resolveMeetingReportTarget({
        booking,
        profile: { id: 'mentor-1' },
        isMentor: true,
      }),
    ).toEqual({
      userId: 'learner-1',
      name: 'Learner Name',
      contextId: 'booking-1',
    });
  });

  it('resolves mentor as target when learner is signed in', () => {
    expect(
      resolveMeetingReportTarget({
        booking,
        user: { id: 'learner-1' },
        isMentor: false,
      }),
    ).toEqual({
      userId: 'mentor-1',
      name: 'Mentor Name',
      contextId: 'booking-1',
    });
  });

  it('prefers otherUser when provided', () => {
    expect(
      resolveMeetingReportTarget({
        booking,
        profile: { id: 'mentor-1' },
        otherUser: { id: 'learner-1', name: 'Alex' },
      }),
    ).toEqual({
      userId: 'learner-1',
      name: 'Alex',
      contextId: 'booking-1',
    });
  });

  it('returns null target when booking ids are missing', () => {
    expect(
      resolveMeetingReportTarget({
        booking: { id: 'booking-1' },
        profile: { id: 'mentor-1' },
      }),
    ).toEqual({
      userId: null,
      name: 'this user',
      contextId: 'booking-1',
    });
  });

  it('compares ids as strings', () => {
    expect(
      resolveMeetingReportTarget({
        booking: {
          ...booking,
          mentor_id: 'mentor-1',
          learner_id: 'learner-1',
        },
        profile: { id: 'mentor-1' },
      }).userId,
    ).toBe('learner-1');
  });
});
