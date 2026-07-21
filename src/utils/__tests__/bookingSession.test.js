import { isBookingSessionPast, isExpiredBooking } from '../bookingSession';

function booking(overrides = {}) {
  return {
    status: 'pending',
    availability_slots: {
      date: '2026-06-13',
      start_time: '10:00',
      end_time: '10:30',
    },
    ...overrides,
  };
}

describe('bookingSession', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('isBookingSessionPast', () => {
    it('returns false when slot date is missing', () => {
      expect(isBookingSessionPast({ availability_slots: {} })).toBe(false);
      expect(isBookingSessionPast({})).toBe(false);
    });

    it('returns false when slot has not started yet', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-13T09:59:00'));

      expect(isBookingSessionPast(booking())).toBe(false);
    });

    it('returns false during the window when a live meeting exists', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-13T10:15:00'));

      expect(
        isBookingSessionPast(booking({ meeting_id: 'live-room-1' })),
      ).toBe(false);
    });

    it('returns false during the window when no meeting was started yet', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-13T10:15:00'));

      // Mentor must still be able to Start / learner Join after slot start
      expect(isBookingSessionPast(booking())).toBe(false);
    });

    it('returns false within 2h grace when end_time is missing', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-13T11:30:00'));

      expect(
        isBookingSessionPast(
          booking({
            availability_slots: {
              date: '2026-06-13',
              start_time: '10:00',
            },
          }),
        ),
      ).toBe(false);
    });

    it('returns true after 2h grace when end_time is missing', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-13T12:01:00'));

      expect(
        isBookingSessionPast(
          booking({
            availability_slots: {
              date: '2026-06-13',
              start_time: '10:00',
            },
          }),
        ),
      ).toBe(true);
    });

    it('returns true when slot end time has passed', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-13T10:31:00'));

      expect(isBookingSessionPast(booking())).toBe(true);
      expect(
        isBookingSessionPast(booking({ meeting_id: 'stale-room' })),
      ).toBe(true);
    });

    it('uses end of day when end_time is missing', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-14T00:00:01'));

      expect(
        isBookingSessionPast(
          booking({
            availability_slots: { date: '2026-06-13' },
          }),
        ),
      ).toBe(true);
    });
  });

  describe('isExpiredBooking', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-13T11:00:00'));
    });

    it('returns false for upcoming sessions', () => {
      jest.setSystemTime(new Date('2026-06-13T09:59:00'));

      expect(isExpiredBooking(booking({ status: 'pending' }))).toBe(false);
    });

    it('returns true for past pending or confirmed bookings', () => {
      expect(isExpiredBooking(booking({ status: 'pending' }))).toBe(true);
      expect(isExpiredBooking(booking({ status: 'confirmed' }))).toBe(true);
    });

    it('returns false for past completed, cancelled, or rejected bookings', () => {
      expect(isExpiredBooking(booking({ status: 'completed' }))).toBe(false);
      expect(isExpiredBooking(booking({ status: 'cancelled' }))).toBe(false);
      expect(isExpiredBooking(booking({ status: 'rejected' }))).toBe(false);
    });
  });
});
