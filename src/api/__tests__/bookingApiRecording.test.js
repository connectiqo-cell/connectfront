jest.mock('../../utils/sessionReminder', () => ({
  cancelSessionReminder: jest.fn(),
}));

const mockFrom = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
  },
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
}));

jest.mock('../recordingsApi', () => ({
  recordingsApi: {},
}));

import { bookingApi } from '../bookingApi';

function chain(result) {
  const chainable = {
    select: jest.fn(() => chainable),
    eq: jest.fn(() => chainable),
    order: jest.fn(() => chainable),
    limit: jest.fn(() => chainable),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
    single: jest.fn(() => Promise.resolve(result)),
    update: jest.fn(() => ({
      eq: jest.fn(() => Promise.resolve({ error: null })),
    })),
  };
  return chainable;
}

describe('bookingApi.resolveRecordingPreferenceForBooking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses transaction preference when booking row is false', async () => {
    const booking = {
      id: 'booking-1',
      slot_id: 'slot-1',
      learner_id: 'learner-1',
      recording_requested: false,
    };

    mockFrom.mockImplementation(table => {
      if (table === 'transactions') {
        return chain({ data: { recording_requested: true }, error: null });
      }
      if (table === 'bookings') {
        return chain({ data: null, error: null });
      }
      return chain({ data: null, error: null });
    });

    const result = await bookingApi.resolveRecordingPreferenceForBooking(booking);

    expect(result.recordingRequested).toBe(true);
    expect(result.booking.recording_requested).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('bookings');
  });

  it('returns false when neither booking nor transaction has yes', async () => {
    const booking = {
      id: 'booking-2',
      slot_id: 'slot-2',
      learner_id: 'learner-2',
      recording_requested: null,
    };

    mockFrom.mockImplementation(table => {
      if (table === 'transactions') {
        return chain({ data: { recording_requested: false }, error: null });
      }
      if (table === 'bookings') {
        return chain({ data: null, error: null });
      }
      return chain({ data: null, error: null });
    });

    const result = await bookingApi.resolveRecordingPreferenceForBooking(booking);

    expect(result.recordingRequested).toBe(false);
  });
});
