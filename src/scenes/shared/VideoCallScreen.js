import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useMeeting,
  MeetingProvider,
  MeetingConsumer,
} from '@videosdk.live/react-native-sdk';
import Toast from 'react-native-simple-toast';
import { UNIFIED_THEME } from '../../unifiedTheme';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { getToken, createMeeting, validateMeeting, fetchRecordingUrl } from '../../api/api';
import { supabase } from '../../lib/supabase';
import { bookingApi } from '../../api/bookingApi';
import { recordingsApi, meetingIdFromBooking } from '../../api/recordingsApi';
import { earningsApi } from '../../api/earningsApi';
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
  const [participantCount, setParticipantCount] = useState(1);
  const joinTimeRef = useRef(null); // Track when both participants joined (use Ref to persist across re-renders)
  const recordingRef = useRef();

  // Log participant count changes
  useEffect(() => {
  }, [participantCount]);

  // Track when both participants have joined
  useEffect(() => {
    if (participantCount >= 2 && !joinTimeRef.current) {
      const now = new Date();
      joinTimeRef.current = now;
    }
  }, [participantCount]);

  // Request permissions on Android
  useEffect(() => {
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

      await initializeCall();
    };

    requestPermissions();
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

      let meetingId;
      let bookingRow;

      if (isHost) {
        meetingId = await createMeeting({ token });
        bookingRow = await bookingApi.getBooking(bookingId);
        await enrichBookingProfiles(bookingRow);
        await bookingApi.setMeetingId({ bookingId, meetingId });
        await recordingsApi.upsertSessionForBooking({
          bookingId,
          mentorId: bookingRow?.mentor_id || profile.id,
          learnerId: bookingRow?.learner_id,
          meetingId,
        });
      } else {
        bookingRow = await bookingApi.getBooking(bookingId);
        await enrichBookingProfiles(bookingRow);
        const mid = bookingRow?.meeting_id || meetingIdFromBooking(bookingRow);
        if (!mid) {
          setBooking(bookingRow);
          setLobbyOnly(true);
          return;
        }
        meetingId = mid;
        await validateMeeting({ meetingId, token });
      }

      setBooking(bookingRow);
      setCallParams({ token, meetingId });
      setReady(true);
    } catch (error) {
      Toast.show(error.message || 'Failed to initialize call');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!lobbyOnly || isHost) return undefined;

    const pollHost = async () => {
      try {
        const row = await bookingApi.getBooking(bookingId);
        await enrichBookingProfiles(row);
        const mid = row?.meeting_id || meetingIdFromBooking(row);
        if (mid) {
          setLobbyOnly(false);
          setLoading(true);
          const token = await getToken();
          await validateMeeting({ meetingId: mid, token });
          setBooking(row);
          setCallParams({ token, meetingId: mid });
          setReady(true);
          setLoading(false);
        }
      } catch (_) {
        /* keep polling */
      }
    };

    const id = setInterval(pollHost, 5000);
    return () => clearInterval(id);
  }, [lobbyOnly, isHost, bookingId]);

  const handleMeetingLeft = async () => {
    try {
      // Only mark as completed if:
      // 1. BOTH mentor and learner joined (joinTimeRef proves both were in call)
      // 2. Meeting lasted at least 10 minutes (600 seconds)
      const endTime = new Date();
      const callDuration = joinTimeRef.current ? Math.round((endTime - joinTimeRef.current) / 1000) : 0;
      const MIN_DURATION_SECONDS = 600; // 10 minutes
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

        // If host, create earnings record
        if (isHost) {
          try {
            const { data: mp } = await supabase
              .from('mentor_profiles')
              .select('price_per_hour')
              .eq('id', profile.id)
              .single();
            const pricePerHour = mp?.price_per_hour || 0;
            await earningsApi.createEarning({
              mentorId: profile.id,
              bookingId,
              amount: pricePerHour,
            });
          } catch (earningsErr) {
            console.warn('⚠️ Earnings record skipped:', earningsErr);
          }
        }

        Toast.show('Session completed');
      } else {
        // Check why session wasn't completed
        let reason = '';
        if (!joinTimeRef.current) {
          reason = 'both participants did not join';
          try {
            await bookingApi.clearMeetingId(bookingId);
            Toast.show('Session ended - Meeting abandoned');
          } catch (cleanupError) {
            console.error('⚠️ Failed to clean up meeting_id:', cleanupError);
            Toast.show('Session ended');
          }
        } else if (callDuration < MIN_DURATION_SECONDS) {
          reason = `call was too short (${callDuration}s, min: ${MIN_DURATION_SECONDS}s)`;
          try {
            await bookingApi.clearMeetingId(bookingId);
            Toast.show(`Session too short (${Math.round(callDuration / 60)}min, need 10min)`);
          } catch (cleanupError) {
            console.error('⚠️ Failed to clean up meeting_id:', cleanupError);
            Toast.show('Session ended');
          }
        }
      }

      navigation.goBack();
    } catch (error) {
      console.error('Error ending call:', error);
      navigation.goBack();
    }
  };

  if (loading) {
    return (
      <View style={{
        flex: 1,
        position: 'relative',
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        backgroundColor: UNIFIED_THEME.colors.primary.dark,
      }}>
        <LoadingOverlay visible message="Preparing your call..." />
      </View>
    );
  }

  const isMentor = Boolean(isHost || profile?.id === booking?.mentor_id);
  const resolvedOtherUser = resolveLobbyPartner({
    booking,
    isMentor,
    otherUser: otherProfile,
  });

  if (lobbyOnly && booking) {
    return (
      <View style={{
        flex: 1,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}>
        <SessionLobbyView
          booking={booking}
          isMentor={isMentor}
          otherUser={resolvedOtherUser}
          onLeave={() => navigation.goBack()}
          onReschedule={() => navigation.goBack()}
          onCancelRefund={() => navigation.goBack()}
        />
      </View>
    );
  }

  if (!ready || !callParams) {
    return (
      <View style={{
        flex: 1,
        position: 'relative',
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        backgroundColor: UNIFIED_THEME.colors.primary.dark,
      }}>
        <LoadingOverlay visible message="Connecting..." />
      </View>
    );
  }

  return (
    <View style={{
      flex: 1,
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
    }}>
      <MeetingProvider
        config={{
          meetingId: callParams.meetingId,
          micEnabled: false,
          webcamEnabled: false,
          name: profile?.name || 'Guest',
          notification: {
            title: 'Session in Progress',
            message: 'Your mentoring session is active',
          },
          defaultCamera: 'front',
        }}
        token={callParams.token}
      >
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
              />
            )}
          </MeetingConsumer>
        </CallErrorBoundary>
      </MeetingProvider>
    </View>
  );
}
