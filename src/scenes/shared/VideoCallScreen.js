import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  PermissionsAndroid,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MeetingProvider,
  MeetingConsumer,
} from '@videosdk.live/react-native-sdk';
import Toast from 'react-native-simple-toast';
import { UNIFIED_THEME } from '../../unifiedTheme';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { getToken, createMeeting, fetchRecordingUrl } from '../../api/api';
import { supabase } from '../../lib/supabase';
import { bookingApi } from '../../api/bookingApi';
import { rescheduleApi } from '../../api/rescheduleApi';
import { recordingsApi, meetingIdFromBooking } from '../../api/recordingsApi';
import { profileApi } from '../../api/profileApi';
import { useAuth } from '../../hooks/useAuth';
import { resolveLobbyPartner } from '../../utils/sessionLobbyRules';
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
  const { bookingId, isHost } = route.params;
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [callParams, setCallParams] = useState(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [otherProfile, setOtherProfile] = useState(null);
  const [lobbyOnly, setLobbyOnly] = useState(false);
  const [meetingReady, setMeetingReady] = useState(false);
  const [pendingCallParams, setPendingCallParams] = useState(null);
  const [startingSession, setStartingSession] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);
  const joinTimeRef = useRef(null); // Track when both participants joined (use Ref to persist across re-renders)
  const recordingRef = useRef();

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
          Toast.show('Microphone permission required for video calls');
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
      if (Platform.OS === 'ios') {
        const { releaseIosCallAudioSession } = require('../../utils/iosCallAudioSession');
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
      await enrichBookingProfiles(bookingRow);
      setBooking(bookingRow);
      setLobbyOnly(true);

      if (isHost) {
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

  const handleStartSession = async () => {
    try {
      setStartingSession(true);
      if (Platform.OS === 'ios') {
        const { ensureIosCallAudioSession } = require('../../utils/iosCallAudioSession');
        const audioReady = await ensureIosCallAudioSession();
        if (!audioReady) {
          Toast.show('Microphone permission required');
          return;
        }
      }
      const token = await getToken();

      // Always fetch fresh booking to check for an existing room.
      // Mentor may be rejoining after a network drop — reuse same meeting_id
      // so the learner (still in the old room) doesn't end up in a different session.
      const freshBooking = await bookingApi.getBooking(bookingId);
      const existingMid = freshBooking?.meeting_id || meetingIdFromBooking(freshBooking);

      let meetingId;
      if (existingMid) {
        // Rejoin the existing VideoSDK room — no new pipeline created
        meetingId = existingMid;
      } else {
        meetingId = await createMeeting({ token });
        await bookingApi.setMeetingId({ bookingId, meetingId });
        await recordingsApi.upsertSessionForBooking({
          bookingId,
          mentorId: booking?.mentor_id || profile.id,
          learnerId: booking?.learner_id,
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
    if (!lobbyOnly || isHost) return undefined;

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
  }, [lobbyOnly, isHost, bookingId]);

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
        Toast.show('Microphone permission required');
        return;
      }
    }
    setLobbyOnly(false);
    setCallParams(pendingCallParams);
    setReady(true);
  };

  const handleMeetingLeft = async () => {
    try {
      // Only mark as completed if:
      // 1. BOTH mentor and learner joined (joinTimeRef proves both were in call)
      // 2. Meeting lasted at least 5 minutes (300 seconds)
      const endTime = new Date();
      const callDuration = joinTimeRef.current ? Math.round((endTime - joinTimeRef.current) / 1000) : 0;
      const MIN_DURATION_SECONDS = 300; // 5 minutes
      const shouldMarkComplete = !!joinTimeRef.current && callDuration >= MIN_DURATION_SECONDS;


      if (shouldMarkComplete) {
        // Update booking status to completed
        await bookingApi.updateBookingStatus({
          bookingId,
          status: 'completed',
        });

        // Persist recording URL to booking (host-side best effort with retries).
        if (isHost && callParams?.meetingId && callParams?.token) {
          const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
          let recordingUrl = null;

          for (let attempt = 1; attempt <= 8; attempt += 1) {
            recordingUrl = await fetchRecordingUrl({
              meetingId: callParams.meetingId,
              token: callParams.token,
            });
            if (recordingUrl) break;
            // Recording file may take some time after session end to become available.
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
                meetingId: callParams.meetingId,
              });
            } catch (recErr) {
              console.warn('⚠️ Recording URL save skipped (recordings table not set up):', recErr);
            }
          } else {
          }
        }

        Toast.show('Session completed');
      } else {
        // Check why session wasn't completed
        let reason = '';
        if (!joinTimeRef.current) {
          reason = 'both participants did not join';
          if (isHost) {
            try {
              await bookingApi.clearMeetingId(bookingId);
            } catch (cleanupError) {
              console.error('⚠️ Failed to clean up meeting_id:', cleanupError);
            }
          }
          Toast.show('Session ended - Meeting abandoned');
        } else if (callDuration < MIN_DURATION_SECONDS) {
          // Both were in the call but it was too short for "completed" status.
          // Keep meeting_id intact — mentor/learner can rejoin the same room
          // without spinning up a new session pipeline.
          Toast.show('Session ended — minimum 5 minutes required for completion');
        }
      }

      navigation.goBack();
    } catch (error) {
      console.error('Error ending call:', error);
      navigation.goBack();
    }
  };

  const VOID_BG = UNIFIED_THEME.colors.primary.void;

  const screenShell = (children, bg = VOID_BG) => {
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
    return screenShell(<LoadingOverlay visible message="Preparing your call..." />, UNIFIED_THEME.colors.primary.dark);
  }

  const isMentor = Boolean(isHost || profile?.id === booking?.mentor_id);
  const resolvedOtherUser = resolveLobbyPartner({
    booking,
    isMentor,
    otherUser: otherProfile,
  });

  if (lobbyOnly && booking) {
    return screenShell(
      <SessionLobbyView
        booking={booking}
        isMentor={isMentor}
        otherUser={resolvedOtherUser}
        meetingReady={meetingReady}
        onJoinCall={isHost ? handleStartSession : handleJoinCall}
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
      UNIFIED_THEME.colors.primary.dark,
    );
  }

  if (!ready || !callParams) {
    return screenShell(<LoadingOverlay visible message="Connecting..." />, UNIFIED_THEME.colors.primary.dark);
  }

  return screenShell(
    <MeetingProvider
      config={{
        meetingId: callParams.meetingId,
        micEnabled: false,
        webcamEnabled: true,
        name: profile?.name || 'Guest',
        notification: {
          title: 'Session in Progress',
          message: 'Your mentoring session is active',
        },
        defaultCamera: 'front',
      }}
      token={callParams.token}
    >
      <View style={{ flex: 1 }}>
        <CallErrorBoundary onLeave={() => navigation.goBack()}>
          <MeetingConsumer onMeetingLeft={handleMeetingLeft}>
            {() => (
              <MeetingContainer
                meetingType="ONE_TO_ONE"
                onParticipantCountChange={setParticipantCount}
                isHost={isHost}
                isMentor={isMentor}
                booking={booking}
                otherUser={resolvedOtherUser}
                onLeaveSession={handleMeetingLeft}
                maxDurationMs={20 * 60 * 1000}
              />
            )}
          </MeetingConsumer>
        </CallErrorBoundary>
      </View>
    </MeetingProvider>,
  );
}
