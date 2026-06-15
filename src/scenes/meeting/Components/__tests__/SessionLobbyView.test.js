import React from 'react';
import renderer, { act } from 'react-test-renderer';
import SessionLobbyView from '../SessionLobbyView';

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

  it('shows pre-start panel before slot opens', () => {
    let tree;
    act(() => {
      tree = renderer.create(
        <SessionLobbyView {...baseProps} booking={buildBooking({ startOffsetMin: 30 })} />
      );
    });

    const text = flattenText(tree.toJSON());
    expect(text).toContain('Before your session starts');
    expect(text).toContain('Leave waiting room');
    expect(text).not.toContain('Wait 5 more minutes');
    expect(text).not.toContain("hasn't joined yet");
  });

  it('shows no-show panel when slot is live', () => {
    let tree;
    act(() => {
      tree = renderer.create(
        <SessionLobbyView {...baseProps} booking={buildBooking({ startOffsetMin: -5 })} />
      );
    });

    const text = flattenText(tree.toJSON());
    expect(text).toContain("Alex Mentor hasn't joined yet");
    expect(text).not.toContain('Wait 5 more minutes');
    expect(text).toContain('Cancel & Get Refund');
    expect(text).not.toContain('Before your session starts');
  });

  it('shows mentor end-session copy for hosts', () => {
    let tree;
    act(() => {
      tree = renderer.create(
        <SessionLobbyView
          {...baseProps}
          isMentor
          otherUser={{ name: 'Sam Learner' }}
          booking={buildBooking({ startOffsetMin: -5 })}
        />
      );
    });

    const text = flattenText(tree.toJSON());
    expect(text).toContain('End Session');
    expect(text).not.toContain('Cancel & Get Refund');
  });

  it('transitions to expired when slot ends', () => {
    let tree;
    act(() => {
      tree = renderer.create(
        <SessionLobbyView {...baseProps} booking={buildBooking({ startOffsetMin: -35, durationMin: 30 })} />
      );
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    const text = flattenText(tree.toJSON());
    expect(text).toContain('Time Expired');
  });
});
