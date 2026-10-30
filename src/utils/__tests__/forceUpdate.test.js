jest.mock('../../lib/supabase', () => ({ supabase: {} }));

import { needsUpdate } from '../forceUpdate';

describe('needsUpdate', () => {
  it('blocks older builds only', () => {
    expect(needsUpdate(20, '21')).toBe(true);
    expect(needsUpdate(20, '20')).toBe(false);
    expect(needsUpdate(21, '20')).toBe(false);
  });

  it('never blocks on a missing or junk value', () => {
    expect(needsUpdate(20, undefined)).toBe(false);
    expect(needsUpdate(20, '')).toBe(false);
    expect(needsUpdate(20, 'soon')).toBe(false);
  });
});
