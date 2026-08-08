import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { ROBOTO_FONTS } from '../../../styles/fonts';
import { useThemedStyles } from '../../../hooks/useTheme';
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
 * Fires `onSlotEnded` once when the booked slot reaches end time.
 */
export default function CallSessionTimer({ slot, onSlotEnded }) {
  const styles = useThemedStyles(createTimerStyles);
  const hasSlotTimer = Boolean(slot?.date);
  const meetingStartedAtRef = useRef(Date.now());
  const endedNotifiedRef = useRef(false);
  const onSlotEndedRef = useRef(onSlotEnded);
  onSlotEndedRef.current = onSlotEnded;
  const [meetingElapsedSeconds, setMeetingElapsedSeconds] = useState(0);
  const [sessionTiming, setSessionTiming] = useState(() =>
    computeSessionTiming(slot || {}),
  );

  useEffect(() => {
    meetingStartedAtRef.current = Date.now();
    setMeetingElapsedSeconds(0);
    endedNotifiedRef.current = false;
  }, []);

  useEffect(() => {
    const notifyIfEnded = timing => {
      if (timing?.status !== 'ended' || endedNotifiedRef.current) {
        return;
      }
      endedNotifiedRef.current = true;
      onSlotEndedRef.current?.();
    };

    const tick = () => {
      setMeetingElapsedSeconds(
        Math.floor((Date.now() - meetingStartedAtRef.current) / 1000),
      );
      if (slot?.date) {
        const next = computeSessionTiming(slot);
        setSessionTiming(next);
        notifyIfEnded(next);
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
    : 'Elapsed';

  return (
    <View style={styles.pill}>
      {hasSlotTimer && sessionTiming.status === 'live' ? (
        <View style={styles.liveDot} />
      ) : null}
      <View>
        <Text style={styles.label}>{reverseTimerLabel}</Text>
        <Text style={styles.value}>{reverseTimerValue}</Text>
      </View>
    </View>
  );
}

function createTimerStyles(theme) {
  const M = theme.colors.meeting;
  const active = theme.colors.status.active;

  return StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 7 : 6,
      borderRadius: 20,
      backgroundColor: M.sheet,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: M.controlBorder,
      minWidth: 96,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: active,
    },
    label: {
      fontSize: 10,
      fontFamily: ROBOTO_FONTS.RobotoMedium,
      color: M[400],
      marginBottom: 1,
    },
    value: {
      fontSize: 15,
      fontFamily: ROBOTO_FONTS.RobotoBold,
      color: M[100],
      fontVariant: ['tabular-nums'],
    },
  });
}
