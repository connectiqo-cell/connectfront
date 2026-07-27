import { areSlotsContiguous, normalizeSlotTime } from '../contiguousSlots';

describe('contiguousSlots', () => {
  it('normalizes times', () => {
    expect(normalizeSlotTime('10:00:00')).toBe('10:00');
    expect(normalizeSlotTime('10:30')).toBe('10:30');
  });

  it('allows empty or single slot', () => {
    expect(areSlotsContiguous([])).toBe(true);
    expect(areSlotsContiguous([{ start_time: '10:00', end_time: '10:30' }])).toBe(true);
  });

  it('accepts back-to-back slots', () => {
    expect(
      areSlotsContiguous([
        { start_time: '10:00', end_time: '10:30' },
        { start_time: '10:30', end_time: '11:00' },
        { start_time: '11:00', end_time: '11:30' },
      ]),
    ).toBe(true);
  });

  it('rejects gaps', () => {
    expect(
      areSlotsContiguous([
        { start_time: '10:00', end_time: '10:30' },
        { start_time: '11:00', end_time: '11:30' },
      ]),
    ).toBe(false);
  });
});
