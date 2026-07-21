import React, { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import colors from '../../../styles/colors';
import { ROBOTO_FONTS } from '../../../styles/fonts';
import { computeSessionTiming, formatCountdown } from '../../../utils/sessionSlotTimer';

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

/**
 * Isolated call timer — owns 1 Hz updates so the parent call screen
 * (video views, menus) does not re-render every second.
 */
export default function CallSessionTimer({ slot }) {
  const hasSlotTimer = Boolean(slot?.date);
  const meetingStartedAtRef = useRef(Date.now());
  const [meetingElapsedSeconds, setMeetingElapsedSeconds] = useState(0);
  const [sessionTiming, setSessionTiming] = useState(() =>
    computeSessionTiming(slot || {}),
  );

  useEffect(() => {
    meetingStartedAtRef.current = Date.now();
    setMeetingElapsedSeconds(0);
  }, []);

  useEffect(() => {
    const tick = () => {
      setMeetingElapsedSeconds(
        Math.floor((Date.now() - meetingStartedAtRef.current) / 1000),
      );
      if (slot?.date) {
        setSessionTiming(computeSessionTiming(slot));
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [slot?.date, slot?.start_time, slot?.end_time]);

  const reverseTimerValue = hasSlotTimer
    ? sessionTiming.status === 'upcoming'
      ? formatCountdown(sessionTiming.untilStartSec)
      : sessionTiming.status === 'live'
        ? formatCountdown(sessionTiming.remainingSec)
        : '00:00'
    : formatDuration(meetingElapsedSeconds);

  const reverseTimerLabel = hasSlotTimer
    ? sessionTiming.status === 'upcoming'
      ? 'Starts in'
      : sessionTiming.status === 'live'
        ? 'Time left'
        : 'Ended'
    : null;

  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        marginRight: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minWidth: hasSlotTimer ? 108 : undefined,
      }}
    >
      {hasSlotTimer && sessionTiming.status === 'live' ? (
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.statusActive,
          }}
        />
      ) : null}
      <View>
        {reverseTimerLabel ? (
          <Text
            style={{
              fontSize: 10,
              fontFamily: ROBOTO_FONTS.RobotoMedium,
              color: colors.primary[200],
              marginBottom: 1,
            }}
          >
            {reverseTimerLabel}
          </Text>
        ) : null}
        <Text
          style={{
            fontSize: 15,
            fontFamily: ROBOTO_FONTS.RobotoBold,
            color: colors.primary[100],
            fontVariant: ['tabular-nums'],
          }}
        >
          {reverseTimerValue}
        </Text>
      </View>
    </View>
  );
}
