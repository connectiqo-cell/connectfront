import {
  formatCountdown,
  computeSessionTiming,
  slotDurationMinutes,
  getSlotStartMs,
  getSlotEndMs,
  pad2,
} from '../sessionSlotTimer';

function atLocal(y, m, d, h, min, sec = 0) {
  return new Date(y, m - 1, d, h, min, sec).getTime();
}

const SLOT = {
  date: '2026-06-13',
  start_time: '10:00',
  end_time: '10:30',
};

describe('sessionSlotTimer', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('pad2', () => {
    it('pads single digits', () => {
      expect(pad2(5)).toBe('05');
      expect(pad2(0)).toBe('00');
    });
  });

  describe('formatCountdown', () => {
    it('formats mm:ss under one hour', () => {
      expect(formatCountdown(125)).toBe('02:05');
      expect(formatCountdown(0)).toBe('00:00');
    });

    it('formats hh:mm:ss at one hour or more', () => {
      expect(formatCountdown(3661)).toBe('01:01:01');
    });
  });

  describe('slotDurationMinutes', () => {
    it('returns minutes between start and end', () => {
      expect(slotDurationMinutes('10:00', '10:30')).toBe(30);
      expect(slotDurationMinutes('09:15', '10:00')).toBe(45);
    });

    it('defaults to 30 when times missing', () => {
      expect(slotDurationMinutes(null, null)).toBe(30);
    });
  });

  describe('getSlotStartMs / getSlotEndMs', () => {
    it('parses local slot boundaries', () => {
      expect(getSlotStartMs(SLOT.date, SLOT.start_time)).toBe(atLocal(2026, 6, 13, 10, 0));
      expect(getSlotEndMs(SLOT.date, SLOT.end_time)).toBe(atLocal(2026, 6, 13, 10, 30));
    });
  });

  describe('computeSessionTiming', () => {
    it('returns upcoming before slot start', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(atLocal(2026, 6, 13, 9, 50)));

      const t = computeSessionTiming(SLOT);
      expect(t.status).toBe('upcoming');
      expect(t.untilStartSec).toBe(10 * 60);
      expect(t.elapsedSec).toBe(0);
      expect(t.remainingSec).toBe(40 * 60);
    });

    it('returns live during the slot window', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(atLocal(2026, 6, 13, 10, 10)));

      const t = computeSessionTiming(SLOT);
      expect(t.status).toBe('live');
      expect(t.untilStartSec).toBe(0);
      expect(t.elapsedSec).toBe(10 * 60);
      expect(t.remainingSec).toBe(20 * 60);
      expect(t.totalSec).toBe(30 * 60);
    });

    it('returns live at exact slot start', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(atLocal(2026, 6, 13, 10, 0)));

      const t = computeSessionTiming(SLOT);
      expect(t.status).toBe('live');
      expect(t.elapsedSec).toBe(0);
      expect(t.remainingSec).toBe(30 * 60);
    });

    it('returns ended after slot end', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(atLocal(2026, 6, 13, 10, 30)));

      const t = computeSessionTiming(SLOT);
      expect(t.status).toBe('ended');
      expect(t.remainingSec).toBe(0);
      expect(t.elapsedSec).toBe(t.totalSec);
    });

    it('defaults to live when slot date missing', () => {
      const t = computeSessionTiming({});
      expect(t.status).toBe('live');
    });
  });
});
