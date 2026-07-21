import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-vector-icons/MaterialIcons', () => 'MaterialIcons');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../../../components/CosmicBackground', () => {
  const { View } = require('react-native');
  return ({ children, style }) => <View style={style}>{children}</View>;
});
jest.mock('../../../../components/CosmicButton', () => {
  const { Pressable, Text } = require('react-native');
  return ({ label, onPress }) => (
    <Pressable onPress={onPress}>
      <Text>{label}</Text>
    </Pressable>
  );
});
jest.mock('../../../../components/IosGradientShell', () => {
  const { View } = require('react-native');
  return ({ children, style }) => <View style={style}>{children}</View>;
});

import SessionLobbyView from '../SessionLobbyView';

function flattenText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(flattenText).join(' ');
  if (node.children) return flattenText(node.children);
  return '';
}

function buildBooking({ startOffsetMin = 30, durationMin = 30 } = {}) {
  const start = new Date(Date.now() + startOffsetMin * 60 * 1000);
  const end = new Date(start.getTime() + durationMin * 60 * 1000);
  const pad = n => String(n).padStart(2, '0');
  return {
    availability_slots: {
      date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
      start_time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
      end_time: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
    },
  };
}

const baseProps = {
  isMentor: false,
  otherUser: { name: 'Alex Mentor' },
  connecting: false,
  micOn: true,
  camOn: false,
  onToggleMic: jest.fn(),
  onToggleCam: jest.fn(),
  onLeave: jest.fn(),
  onReschedule: jest.fn(),
  onCancelRefund: jest.fn(),
};

describe('SessionLobbyView', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows waiting room before slot opens', () => {
    let tree;
    act(() => {
      tree = renderer.create(
        <SessionLobbyView {...baseProps} booking={buildBooking({ startOffsetMin: 30 })} />,
      );
    });

    const text = flattenText(tree.toJSON());
    expect(text).toContain('Waiting Room');
    expect(text).toContain('until session starts');
    expect(text).toContain('Join Call');
    expect(text).toContain('Waiting for mentor to start the session');
    expect(text).not.toContain('time remaining');
  });

  it('shows live waiting state when slot is open', () => {
    let tree;
    act(() => {
      tree = renderer.create(
        <SessionLobbyView {...baseProps} booking={buildBooking({ startOffsetMin: -5 })} />,
      );
    });

    const text = flattenText(tree.toJSON());
    expect(text).toContain('Waiting Room');
    expect(text).toContain('time remaining');
    expect(text).toContain('Join Call');
    expect(text).toContain('Waiting for mentor to start the session');
    expect(text).not.toContain('until session starts');
  });

  it('shows mentor start-session CTA for hosts', () => {
    let tree;
    act(() => {
      tree = renderer.create(
        <SessionLobbyView
          {...baseProps}
          isMentor
          otherUser={{ name: 'Sam Learner' }}
          booking={buildBooking({ startOffsetMin: -5 })}
        />,
      );
    });

    const text = flattenText(tree.toJSON());
    expect(text).toContain('Start Session');
    expect(text).toContain('Ready to start');
    expect(text).toContain('Sam Learner');
    expect(text).not.toContain('Join Call');
  });

  it('shows recording notice when learner requested recording at booking', () => {
    let tree;
    act(() => {
      tree = renderer.create(
        <SessionLobbyView
          {...baseProps}
          isMentor
          otherUser={{ name: 'Sam Learner' }}
          booking={{
            ...buildBooking({ startOffsetMin: -5 }),
            recording_requested: true,
          }}
        />,
      );
    });

    const text = flattenText(tree.toJSON());
    expect(text).toContain('learner requested a recording');
    expect(text).toContain('Start Session');
  });

  it('transitions to expired when slot ends', () => {
    let tree;
    act(() => {
      tree = renderer.create(
        <SessionLobbyView
          {...baseProps}
          booking={buildBooking({ startOffsetMin: -35, durationMin: 30 })}
        />,
      );
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    const text = flattenText(tree.toJSON());
    expect(text).toContain('Time Expired');
  });
});
