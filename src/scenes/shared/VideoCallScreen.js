import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  PermissionsAndroid,
  Alert,
  BackHandler,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MeetingProvider,
  MeetingConsumer,
} from '@videosdk.live/react-native-sdk';
import Toast from 'react-native-simple-toast';
import { useTheme } from '../../hooks/useTheme';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { getToken, createMeeting, fetchRecordingUrl } from '../../api/api';
import { supabase } from '../../lib/supabase';
import { bookingApi } from '../../api/bookingApi';
import { rescheduleApi } from '../../api/rescheduleApi';
import { recordingsApi, meetingIdFromBooking } from '../../api/recordingsApi';
import { profileApi } from '../../api/profileApi';
import { useAuth } from '../../hooks/useAuth';
import { resolveLobbyPartner } from '../../utils/sessionLobbyRules';
import {
  markIosCallAudioSessionEnded,
  releaseIosCallAudioSession,
} from '../../utils/iosCallAudioSession';
import { scheduleMeetingLeaveNavigation } from '../../utils/meetingLeave';
import { resolveSessionEndOutcome } from '../../utils/sessionEndOutcome';
import MeetingContainer from '../meeting/MeetingContainer';
import SessionLobbyView from '../meeting/Components/SessionLobbyView';

class CallErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('CallErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a1a', padding: 24 }}>
          <Text style={{ color: '#fff', fontSize: 16, marginBottom: 8, textAlign: 'center' }}>
            Something went wrong during the call
          </Text>
          <Text style={{ color: '#888', fontSize: 13, marginBottom: 24, textAlign: 'center' }}>
            The session could not continue
          </Text>
          <TouchableOpacity
            onPress={this.props.onLeave}
            style={{ paddingVertical: 12, paddingHorizontal: 28, backgroundColor: '#6366f1', borderRadius: 8 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Leave Call</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function VideoCallScreen({ navigation, route }) {
  const bookingId = route?.params?.bookingId ?? route?.params?.roomId;
  const { profile } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  /** Live call chrome stays dark in both app themes (video convention). */
  const meetingBg = theme.colors.meeting[900];
  const lobbyBg = theme.colors.primary.void;
  const [ready, setReady] = useState(false);
  const [callParams, setCallParams] = useState(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [otherProfile, setOtherProfile] = useState(null);
  const [lobbyOnly, setLobbyOnly] = useState(false);
  const [meetingReady, setMeetingReady] = useState(false);
  const [pendingCallParams, setPendingCallParams] = useState(null);
  const [startingSession, setStartingSession] = useState(false);
  const [mentorRecordingConsented, setMentorRecordingConsented] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);
  const joinTimeRef = useRef(null); // Track when both participants joined (use Ref to persist across re-renders)
  const recordingRef = useRef();
  const sessionEndedRef = useRef(false);
  const leaveNavTimerRef = useRef(null);
  // Host authority must come from booking membership, never route params.
  const isMentorHost = Boolean(
    profile?.id && booking?.mentor_id && profile.id === booking.mentor_id,
  );
  const isMentorHostRef = useRef(isMentorHost);
  isMentorHostRef.current = isMentorHost;

  useEffect(() => {
    if (!bookingId) {
      Toast.show('Missing booking — open the call from Sessions or Bookings');
      navigation.goBack();
    }
  }, [bookingId, navigation]);

  useEffect(() => {
    return () => {
      if (leaveNavTimerRef.current) {
        clearTimeout(leaveNavTimerRef.current);
        leaveNavTimerRef.current = null;
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android' || ready) {
        return undefined;
      }
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        navigation.goBack();
        return true;
      });
      return () => subscription.remove();
    }, [ready, navigation]),
  );

  // Track when both participants have joined
  useEffect(() => {
    if (participantCount >= 2 && !joinTimeRef.current) {
      const now = new Date();
      joinTimeRef.current = now;
    }
  }, [participantCount]);

  // Android: permission flow unchanged. iOS: separate AVAudioSession setup (see iosCallAudioSession.js).
  useEffect(() => {
    let cancelled = false;

    const requestPermissions = async () => {
      if (Platform.OS === 'android') {
        try {
          const permissions = [
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            PermissionsAndroid.PERMISSIONS.CAMERA,
          ];

          const granted = await PermissionsAndroid.requestMultiple(permissions);
          const allGranted = permissions.every(
            permission => granted[permission] === PermissionsAndroid.RESULTS.GRANTED
          );

          if (!allGranted) {
            Toast.show('Camera and microphone permissions required');
            navigation.goBack();
            return;
          }
        } catch (error) {
          console.error('Permission error:', error);
        }
      }

      if (Platform.OS === 'ios') {
        const { ensureIosCallAudioSession } = require('../../utils/iosCallAudioSession');
        const audioReady = await ensureIosCallAudioSession();
        if (cancelled) return;
        if (!audioReady) {
          Toast.show('Camera and microphone permissions are required for video calls');
          navigation.goBack();
          return;
        }
      }

      if (!cancelled) {
        await initializeCall();
      }
    };

    requestPermissions();

    return () => {
      cancelled = true;
      if (Platform.OS === 'ios' && !sessionEndedRef.current) {
        releaseIosCallAudioSession();
      }
    };
  }, []);

  const enrichBookingProfiles = async row => {
    if (!row) return row;
    const isMentorUser = profile?.id === row.mentor_id;
    const otherId = isMentorUser ? row.learner_id : row.mentor_id;
    try {
      const other = await profileApi.getProfile(otherId);
      setOtherProfile(other);
    } catch (_) {
      setOtherProfile(null);
    }
    return row;
  };

  const initializeCall = async () => {
    try {
      const token = await getToken();
      const bookingRow = await bookingApi.getBooking(bookingId);
      const isMentorUser = profile?.id === bookingRow?.mentor_id;
      const isLearnerUser = profile?.id === bookingRow?.learner_id;

      if (!profile?.id || (!isMentorUser && !isLearnerUser)) {
        Toast.show('You are not a participant in this session');
        navigation.goBack();
        return;
      }

      await enrichBookingProfiles(bookingRow);
      setBooking(bookingRow);
      setLobbyOnly(true);

      if (isMentorUser) {
        // Mentor controls when the session starts — button is always green.
        setMeetingReady(true);
      } else {
        // Learner: ready only if mentor already created the room.
        const mid = bookingRow?.meeting_id || meetingIdFromBooking(bookingRow);
        if (mid) {
          setPendingCallParams({ token, meetingId: mid });
          setMeetingReady(true);
        }
      }
    } catch (error) {
      Toast.show(error.message || 'Failed to initialize call');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const askMentorRecordingConsent = useCallback(() => (
    new Promise(resolve => {
      Alert.alert(
        'Session recording permission',
        'The learner requested a recording when booking. Do you agree to record this session?',
        [
          {
            text: 'Join without recording',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Agree & record',
            onPress: () => resolve(true),
          },
        ],
        { cancelable: false },
      );
    })
  ), []);

  const handleStartSession = async () => {
    try {
      setStartingSession(true);
      if (Platform.OS === 'ios') {
        const { ensureIosCallAudioSession } = require('../../utils/iosCallAudioSession');
        const audioReady = await ensureIosCallAudioSession();
        if (!audioReady) {
          Toast.show('Camera and microphone permissions are required');
          return;
        }
      }
      const token = await getToken();

      // Always fetch fresh booking to check for an existing room.
      // Mentor may be rejoining after a network drop — reuse same meeting_id
      // so the learner (still in the old room) doesn't end up in a different session.
      const freshBooking = await bookingApi.getBooking(bookingId);
      if (profile?.id !== freshBooking?.mentor_id) {
        Toast.show('Only the mentor can start this session');
        return;
      }

      const existingMid = freshBooking?.meeting_id || meetingIdFromBooking(freshBooking);
      setBooking(freshBooking);

      const recordingConsent = freshBooking?.recording_requested === true
        ? await askMentorRecordingConsent()
        : false;
      setMentorRecordingConsented(recordingConsent);

      let meetingId;
      if (existingMid) {
        // Rejoin the existing VideoSDK room — no new pipeline created
        meetingId = existingMid;
      } else {
        meetingId = await createMeeting({ token });
        await bookingApi.setMeetingId({ bookingId, meetingId });
        await recordingsApi.upsertSessionForBooking({
          bookingId,
          mentorId: freshBooking.mentor_id,
          learnerId: freshBooking.learner_id,
          meetingId,
        });
      }

      setLobbyOnly(false);
      setCallParams({ token, meetingId });
      setReady(true);
    } catch (error) {
      Toast.show(error.message || 'Failed to start session');
    } finally {
      setStartingSession(false);
    }
  };

  useEffect(() => {
    if (!lobbyOnly || isMentorHost) return undefined;

    const applyRow = async (row) => {
      try {
        const mid = row?.meeting_id || meetingIdFromBooking(row);
        if (mid) {
          const tok = await getToken();
          setBooking(row);
          setPendingCallParams({ token: tok, meetingId: mid });
          setMeetingReady(true);
        } else {
          // Mentor left / restarted — reset so learner waits again
          setPendingCallParams(null);
          setMeetingReady(false);
        }
      } catch (_) {}
    };

    // Realtime subscription — Supabase pushes the update the instant mentor
    // writes a meeting_id, no more 5-second polling lag.
    const channel = supabase
      .channel(`booking-meeting-${bookingId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${bookingId}` },
        (payload) => applyRow(payload.new)
      )
      .subscribe();

    // Safety fallback poll every 30 s — catches the case where the Realtime
    // connection wasn't established yet when the mentor started.
    const fallbackId = setInterval(async () => {
      try {
        const row = await bookingApi.getBooking(bookingId);
        await applyRow(row);
      } catch (_) {}
    }, 30_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(fallbackId);
    };
  }, [lobbyOnly, isMentorHost, bookingId]);

  const handleJoinCall = async () => {
    if (!meetingReady || !pendingCallParams) {
      Alert.alert(
        'Session Not Started',
        'The mentor hasn\'t started the session yet. Please wait a moment and try again.',
        [{ text: 'OK' }]
      );
      return;
    }
    if (Platform.OS === 'ios') {
      const { ensureIosCallAudioSession } = require('../../utils/iosCallAudioSession');
      const audioReady = await ensureIosCallAudioSession();
      if (!audioReady) {
        Toast.show('Camera and microphone permissions are required');
        return;
      }
    }
    setLobbyOnly(false);
    setCallParams(pendingCallParams);
    setReady(true);
  };

  const runPostCallCleanup = async (snapshotCallParams) => {
    const mentorHost = isMentorHostRef.current;
    const outcome = resolveSessionEndOutcome({
      bothJoinedAt: joinTimeRef.current,
      isMentorHost: mentorHost,
    });

    // Stop cloud recording only when the mentor ends the meeting.
    if (
      outcome.shouldStopRecording &&
      snapshotCallParams?.meetingId &&
      snapshotCallParams?.token
    ) {
      const { stopOneToOneRecordingSession } = require('../../utils/recordingConfig');
      try {
        await stopOneToOneRecordingSession({
          token: snapshotCallParams.token,
          meetingId: snapshotCallParams.meetingId,
        });
      } catch (stopErr) {
        console.warn('[Recording] stop on leave failed:', stopErr?.message);
      }
    }

    if (outcome.kind === 'completed') {
      if (outcome.shouldMarkCompleted) {
        try {
          await bookingApi.updateBookingStatus({
            bookingId,
            status: 'completed',
          });
        } catch (err) {
          console.warn('[Call] Failed to mark booking completed:', err?.message);
        }
      }

      if (
        outcome.shouldFetchRecording &&
        snapshotCallParams?.meetingId &&
        snapshotCallParams?.token
      ) {
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        let recordingUrl = null;

        for (let attempt = 1; attempt <= 8; attempt += 1) {
          recordingUrl = await fetchRecordingUrl({
            meetingId: snapshotCallParams.meetingId,
            token: snapshotCallParams.token,
          });
          if (recordingUrl) break;
          await sleep(attempt <= 3 ? 4000 : 8000);
        }

        if (recordingUrl) {
          try {
            const bookingRow = await bookingApi.getBooking(bookingId);
            await recordingsApi.updateRecordingUrls({
              bookingId,
              recordingUrl,
              recordingPlaybackUrl: recordingUrl,
              mentorId: bookingRow?.mentor_id || profile.id,
              learnerId: bookingRow?.learner_id,
              meetingId: snapshotCallParams.meetingId,
            });
          } catch (recErr) {
            console.warn('⚠️ Recording URL save skipped (recordings table not set up):', recErr);
          }
        }
      }

      Toast.show(outcome.toast);
      return;
    }

    if (outcome.shouldClearMeetingId) {
      try {
        await bookingApi.clearMeetingId(bookingId);
      } catch (cleanupError) {
        console.error('⚠️ Failed to clean up meeting_id:', cleanupError);
      }
    }

    if (outcome.toast) {
      Toast.show(outcome.toast);
    }
  };

  const handleMeetingLeft = useCallback(() => {
    const snapshotCallParams = callParams;

    markIosCallAudioSessionEnded();

    scheduleMeetingLeaveNavigation({
      alreadyEndedRef: sessionEndedRef,
      timerRef: leaveNavTimerRef,
      platform: Platform.OS,
      onNavigate: () => {
        navigation.goBack();
        runPostCallCleanup(snapshotCallParams).catch(error => {
          console.error('Error ending call:', error);
        });
      },
    });
  }, [navigation, callParams]);

  const screenShell = (children, bg = meetingBg) => {
    if (Platform.OS === 'ios') {
      return (
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: bg }}>
          {children}
        </SafeAreaView>
      );
    }
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: bg,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        {children}
      </View>
    );
  };

  if (loading) {
    return screenShell(<LoadingOverlay visible message="Preparing your call..." />, meetingBg);
  }

  const resolvedOtherUser = resolveLobbyPartner({
    booking,
    isMentor: isMentorHost,
    otherUser: otherProfile,
  });

  if (lobbyOnly && booking) {
    return screenShell(
      <SessionLobbyView
        booking={booking}
        isMentor={isMentorHost}
        otherUser={resolvedOtherUser}
        meetingReady={meetingReady}
        onJoinCall={isMentorHost ? handleStartSession : handleJoinCall}
        startingSession={startingSession}
        onLeave={() => navigation.goBack()}
        onReschedule={async () => {
          try {
            await rescheduleApi.markForReschedule(bookingId, 'mentor_noshow');
          } catch (e) {
            console.warn('⚠️ markForReschedule failed:', e.message);
          }
          navigation.goBack();
        }}
        onCancelRefund={() => navigation.goBack()}
      />,
      lobbyBg,
    );
  }

  if (!ready || !callParams) {
    return screenShell(<LoadingOverlay visible message="Connecting..." />, meetingBg);
  }

  return screenShell(
    <MeetingProvider
      config={{
        meetingId: callParams.meetingId,
        micEnabled: false,
        webcamEnabled: Platform.OS !== 'ios',
        name: profile?.name || 'Guest',
        notification: {
          title: 'Session in Progress',
          message: 'Your mentoring session is active',
        },
        defaultCamera: 'front',
      }}
      token={callParams.token}
    >
      <View style={{ flex: 1, backgroundColor: meetingBg }}>
        <CallErrorBoundary onLeave={handleMeetingLeft}>
          <MeetingConsumer>
            {() => (
              <MeetingContainer
                meetingType="ONE_TO_ONE"
                onParticipantCountChange={setParticipantCount}
                isHost={isMentorHost}
                isMentor={isMentorHost}
                booking={booking}
                otherUser={resolvedOtherUser}
                autoStartRecording={isMentorHost && mentorRecordingConsented}
                onLeaveSession={handleMeetingLeft}
                maxDurationMs={20 * 60 * 1000}
              />
            )}
          </MeetingConsumer>
        </CallErrorBoundary>
      </View>
    </MeetingProvider>,
    meetingBg,
  );
}
