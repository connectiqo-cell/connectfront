import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve('light')),
  setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../../../hooks/useTheme', () => {
  const { StyleSheet } = require('react-native');
  const { buildTheme, THEME_MODES } = require('../../../../unifiedTheme');
  const theme = buildTheme(THEME_MODES.LIGHT);
  return {
    useTheme: () => ({ theme, mode: theme.mode, isDark: false }),
    useThemedStyles: factory => factory(theme) || StyleSheet.create({}),
  };
});

import CallSessionTimer from '../CallSessionTimer';
import { getSlotEndMs } from '../../../../utils/sessionSlotTimer';

describe('CallSessionTimer onSlotEnded', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('fires onSlotEnded once when the slot end time is reached', () => {
    jest.useFakeTimers();
    const onSlotEnded = jest.fn();
    const now = new Date(2026, 5, 13, 10, 29, 58).getTime();
    jest.setSystemTime(now);

    const slot = {
      date: '2026-06-13',
      start_time: '10:00',
      end_time: '10:30',
    };
    expect(getSlotEndMs(slot.date, slot.end_time) - now).toBe(2000);

    act(() => {
      renderer.create(
        <CallSessionTimer slot={slot} onSlotEnded={onSlotEnded} />,
      );
    });

    expect(onSlotEnded).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onSlotEnded).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onSlotEnded).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(onSlotEnded).toHaveBeenCalledTimes(1);
  });
});
