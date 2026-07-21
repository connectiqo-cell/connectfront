import {
  isRecordingRequestedForBooking,
  areBothCallParticipantsPresent,
  resolveRecordingRequestedFromRows,
} from '../recordingConsent';

describe('recordingConsent', () => {
  describe('isRecordingRequestedForBooking', () => {
    it('returns true only when learner chose yes at booking', () => {
      expect(isRecordingRequestedForBooking({ recording_requested: true })).toBe(true);
    });

    it('returns false for no, null, or missing preference', () => {
      expect(isRecordingRequestedForBooking({ recording_requested: false })).toBe(false);
      expect(isRecordingRequestedForBooking({ recording_requested: null })).toBe(false);
      expect(isRecordingRequestedForBooking({})).toBe(false);
      expect(isRecordingRequestedForBooking(null)).toBe(false);
    });
  });

  describe('areBothCallParticipantsPresent', () => {
    it('requires local id and at least one remote participant', () => {
      expect(areBothCallParticipantsPresent('local-1', 1)).toBe(true);
      expect(areBothCallParticipantsPresent('local-1', 0)).toBe(false);
      expect(areBothCallParticipantsPresent(null, 1)).toBe(false);
      expect(areBothCallParticipantsPresent(undefined, 2)).toBe(false);
    });
  });

  describe('resolveRecordingRequestedFromRows', () => {
    it('prefers the checkout transaction when both rows are set', () => {
      expect(resolveRecordingRequestedFromRows(
        { recording_requested: true },
        { recording_requested: false },
      )).toBe(false);
      expect(resolveRecordingRequestedFromRows(
        { recording_requested: false },
        { recording_requested: true },
      )).toBe(true);
    });

    it('falls back to booking when transaction is missing', () => {
      expect(resolveRecordingRequestedFromRows(
        { recording_requested: true },
        null,
      )).toBe(true);
      expect(resolveRecordingRequestedFromRows(
        { recording_requested: null },
        { recording_requested: true },
      )).toBe(true);
    });

    it('returns false when both are missing or false', () => {
      expect(resolveRecordingRequestedFromRows({}, null)).toBe(false);
      expect(resolveRecordingRequestedFromRows(
        { recording_requested: false },
        { recording_requested: false },
      )).toBe(false);
    });
  });
});
