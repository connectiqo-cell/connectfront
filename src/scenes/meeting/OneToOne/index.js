import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Platform,
  Alert,
  BackHandler,
  InteractionManager,
} from "react-native";
import { CosmicLoader } from "../../../components/LoadingSpinner";
import {
  useMeeting,
  getAudioDeviceList,
  switchAudioDevice,
  Constants,
  usePubSub,
} from "@videosdk.live/react-native-sdk";
import {
  CallEnd,
  CameraSwitch,
  Chat,
  DownArrow,
  EndForAll,
  Leave,
  MicOff,
  MicOn,
  More,
  Participants,
  Recording,
  ScreenShare,
  VideoOff,
  VideoOn,
} from "../../../assets/icons";
import colors from "../../../styles/colors";
import IconContainer from "../../../components/IconContainer";
import OneToOneCallLayout from "./OneToOneCallLayout";
import CallSessionTimer from "./CallSessionTimer";
import Menu from "../../../components/Menu";
import MenuItem from "../Components/MenuItem";
import { ROBOTO_FONTS } from "../../../styles/fonts";
import Toast from "react-native-simple-toast";
import BottomSheet from "../../../components/BottomSheet";
import ParticipantListViewer from "../Components/ParticipantListViewer";
import ChatViewer from "../Components/ChatViewer";
import ChatMessagePopup from "../Components/ChatMessagePopup";
import Blink from "../../../components/Blink";
import VideosdkRPK from "../../../../VideosdkRPK";
import ParticipantStatsViewer from "../Components/ParticipantStatsViewer";
import {
  startOneToOneRecordingViaAPI,
  startOneToOneRecording,
  stopOneToOneRecordingSession,
} from "../../../utils/recordingConfig";
import { getToken } from "../../../api/api";
import { useBackgroundWebcamRestore } from "../../../hooks/useBackgroundWebcamRestore";
import { useInCallChatPopup } from "../../../hooks/useInCallChatPopup";
import { useOrientation } from "../../../utils/useOrientation";
import { pressScreenShare } from "../../../utils/screenShareActions";
import { getMeetingParticipantSnapshot } from "../../../utils/meetingParticipants";
import { isRecordingRequestedForBooking, areBothCallParticipantsPresent } from "../../../utils/recordingConsent";
import { bookingApi } from "../../../api/bookingApi";
import {
  showIncomingRecordingConsentAlert,
  showMentorOnlyStopAlert,
  showRecordingDeclinedAlert,
  showRequestRecordingConsentAlert,
  showStopRecordingAlert,
  showWaitForPeerAlert,
} from "../../../utils/recordingAlerts";

// VideoSDK Android reports facingMode as "front" / "environment" (not WebRTC
// standard "user" / "environment"). Labels are often just "0" / "1".
// Strategy: prefer facingMode match → label match → index fallback
// (on Android cams[0] is typically back, cams[1] is front).
function resolveCameras(cams) {
  const isFront = c =>
    c.facingMode === 'front' || c.facingMode === 'user' ||
    c.label?.toLowerCase().includes('front') ||
    c.label?.toLowerCase().includes('face');

  const isBack = c =>
    c.facingMode === 'environment' ||
    c.label?.toLowerCase().includes('back') ||
    c.label?.toLowerCase().includes('rear');

  const front = cams.find(isFront)
    ?? (cams.length > 1 ? cams[1] : cams[0]);

  const back = cams.find(isBack)
    ?? cams.find(c => c.deviceId !== front?.deviceId)
    ?? null;

  return { front, back };
}

// MeetingProvider already joins with defaultCamera: 'front'. On iOS, calling
// changeWebcam() right after join restarts capture and often shows a black preview.
function shouldSelectFrontCameraOnInit() {
  return Platform.OS !== "ios";
}

// Alerts are dropped while a Modal (More menu / BottomSheet) is still visible.
function runAfterMenuDismiss(action) {
  InteractionManager.runAfterInteractions(() => {
    const delay = Platform.OS === "ios" ? 350 : 120;
    setTimeout(action, delay);
  });
}

function showDeferredAlert(title, message, buttons, options) {
  runAfterMenuDismiss(() => Alert.alert(title, message, buttons, options));
}

export default function OneToOneMeetingViewer({
  isHost,
  booking,
  recordingRequested: recordingRequestedProp = false,
  autoStartRecording = false,
  onRequestLeave,
  onSessionEnding,
}) {
  const onMeetingError = useCallback((data) => {
    const { code, message } = data;
    Toast.show(`Error: ${code}: ${message}`);
  }, []);

  const {
    participants,
    localParticipant,
    localWebcamOn,
    localMicOn,
    leave,
    end,
    changeWebcam,
    toggleWebcam,
    getWebcams,
    toggleMic,
    presenterId,
    localScreenShareOn,
    toggleScreenShare,
    meetingId,
    startRecording,
    stopRecording,
    recordingState,
    enableScreenShare,
    disableScreenShare,
  } = useMeeting({ onError: onMeetingError });
  const exitMeeting = onRequestLeave || leave;

  const processedConsentMessagesRef = useRef(new Set());
  const localParticipantIdRef = useRef(null);
  const pendingRecordingRequestRef = useRef(null);
  const incomingConsentRequestIdRef = useRef(null);
  const autoRecordingAttemptedRef = useRef(false);
  const isHostRef = useRef(isHost);
  const meetingIdRef = useRef(meetingId);
  const bookingRef = useRef(booking);
  const startRecordingRef = useRef(startRecording);
  const stopRecordingRef = useRef(stopRecording);
  const participantCountRef = useRef(0);
  const recordingStateRef = useRef(recordingState);
  const restRecordingActiveRef = useRef(false);
  const startRecordingSessionRef = useRef(null);
  const publishConsentMessageRef = useRef(null);
  const showIncomingRecordingConsentRef = useRef(null);

  isHostRef.current = isHost;
  meetingIdRef.current = meetingId;
  bookingRef.current = booking;
  startRecordingRef.current = startRecording;
  stopRecordingRef.current = stopRecording;
  recordingStateRef.current = recordingState;

  const processConsentPubSubEntry = useCallback((entry) => {
    if (!entry?.message) return;

    const uniqueMessageId = `${entry.timestamp}-${entry.senderId}-${entry.message}`;
    if (processedConsentMessagesRef.current.has(uniqueMessageId)) {
      return;
    }
    processedConsentMessagesRef.current.add(uniqueMessageId);

    let payload;
    try {
      payload = JSON.parse(entry.message);
    } catch (e) {
      return;
    }

    if (!payload || typeof payload !== 'object' || typeof payload.type !== 'string') {
      return;
    }

    const localId = localParticipantIdRef.current;
    const fromSelf = Boolean(localId && entry.senderId === localId);
    const recordingStateNow = recordingStateRef.current;
    const restActive = restRecordingActiveRef.current;
    const canStartRecording =
      !restActive &&
      (!recordingStateNow ||
        recordingStateNow === Constants.recordingEvents.RECORDING_STOPPED);

    if (payload.type === 'RECORDING_START_APPROVED' && isHostRef.current && canStartRecording) {
      startRecordingSessionRef.current?.();
      return;
    }

    if (fromSelf) {
      return;
    }

    if (
      payload.type === 'RECORDING_CONSENT_REQUEST' &&
      entry.senderId &&
      entry.senderId !== localId
    ) {
      showIncomingRecordingConsentRef.current?.(
        payload.requestId,
        payload.requesterRole || (isHostRef.current ? 'Learner' : 'Mentor'),
      );
      return;
    }

    if (payload.type === 'RECORDING_CONSENT_RESPONSE') {
      if (payload.requestId !== pendingRecordingRequestRef.current) {
        return;
      }
      pendingRecordingRequestRef.current = null;

      if (payload.agreed) {
        Toast.show('You both agreed — recording is starting…');
        if (isHostRef.current) {
          startRecordingSessionRef.current?.();
        } else {
          publishConsentMessageRef.current?.(
            {
              type: 'RECORDING_START_APPROVED',
              requestId: payload.requestId,
              requesterId: localId,
              ts: Date.now(),
            },
            true,
          );
        }
      } else {
        showRecordingDeclinedAlert({ present: showDeferredAlert });
      }
    }
  }, []);

  const recordingConsentPubSub = usePubSub('RECORDING_CONSENT', {
    onMessageReceived: processConsentPubSubEntry,
  });

  const leaveMenu = useRef();
  const bottomSheetRef = useRef();
  const audioDeviceMenuRef = useRef();
  const moreOptionsMenu = useRef();
  const recordingRef = useRef();
  const bothJoinedAtRef = useRef(null);
  const frontCameraIdRef = useRef(null);
  const backCameraIdRef = useRef(null);
  const activeCameraRef = useRef('front');
  const localWebcamOnRef = useRef(localWebcamOn);
  const cameraInitializedRef = useRef(false);

  const localParticipantId = localParticipant?.id;
  const {
    remoteParticipantId,
    participantIds,
    remoteParticipantCount,
    participantCount,
  } = getMeetingParticipantSnapshot(participants, localParticipantId);
  const bothParticipantsPresent = areBothCallParticipantsPresent(
    localParticipantId,
    remoteParticipantCount,
  );

  const localDisplayName = (localParticipant?.displayName || '').split(' ')[0];
  const remoteDisplayName = (
    participants.get(remoteParticipantId)?.displayName || ''
  ).split(' ')[0];

  const [viewLayout, setViewLayout] = useState('split');
  const [primaryParticipantId, setPrimaryParticipantId] = useState(null);
  const orientation = useOrientation();
  const isLandscape = orientation === 'LANDSCAPE';
  const [chatViewer, setchatViewer] = useState(false);
  const [participantListViewer, setparticipantListViewer] = useState(false);
  const [participantStatsViewer, setparticipantStatsViewer] = useState(false);

  const [audioDevice, setAudioDevice] = useState([]);
  const [statParticipantId, setstatParticipantId] = useState("");
  const [restRecordingActive, setRestRecordingActive] = useState(false);
  const [recordingRequestedAtBooking, setRecordingRequestedAtBooking] = useState(
    () => recordingRequestedProp || isRecordingRequestedForBooking(booking),
  );
  const slot = booking?.availability_slots || {};

  useEffect(() => {
    setRecordingRequestedAtBooking(
      recordingRequestedProp || isRecordingRequestedForBooking(booking),
    );
  }, [recordingRequestedProp, booking?.recording_requested]);

  useEffect(() => {
    if (!booking?.id) {
      return undefined;
    }
    let cancelled = false;
    bookingApi
      .resolveRecordingPreferenceForBooking(booking)
      .then(({ recordingRequested }) => {
        if (!cancelled) {
          setRecordingRequestedAtBooking(recordingRequested);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [booking?.id, booking?.recording_requested, recordingRequestedProp]);

  useEffect(() => {
    participantCountRef.current = participantCount;
  }, [participantCount]);

  useEffect(() => {
    restRecordingActiveRef.current = restRecordingActive;
  }, [restRecordingActive]);

  useEffect(() => {
    if (!remoteParticipantId) return;
    setPrimaryParticipantId(prev => {
      if (!prev || (prev !== localParticipantId && prev !== remoteParticipantId)) {
        return remoteParticipantId;
      }
      return prev;
    });
  }, [remoteParticipantId, localParticipantId]);

  const secondaryParticipantId =
    primaryParticipantId === localParticipantId
      ? remoteParticipantId
      : localParticipantId;

  const handleSwapPrimary = useCallback(() => {
    if (secondaryParticipantId) {
      setPrimaryParticipantId(secondaryParticipantId);
    }
  }, [secondaryParticipantId]);

  async function updateAudioDeviceList() {
    const devices = await getAudioDeviceList();
    setAudioDevice(devices);
  }

  useEffect(() => {
    localParticipantIdRef.current = localParticipantId;
  }, [localParticipantId]);

  useEffect(() => {
    localWebcamOnRef.current = localWebcamOn;
  }, [localWebcamOn]);

  useEffect(() => {
    let cancelled = false;
    const fetchCameras = async (attempt = 0) => {
      try {
        const cams = await getWebcams?.();
        if (cancelled) return;
        if (cams?.length) {
          const { front, back } = resolveCameras(cams);
          frontCameraIdRef.current = front?.deviceId ?? null;
          backCameraIdRef.current = back?.deviceId ?? null;

          if (localWebcamOnRef.current && !cameraInitializedRef.current) {
            cameraInitializedRef.current = true;
            if (shouldSelectFrontCameraOnInit() && front?.deviceId) {
              setTimeout(() => {
                if (!cancelled) changeWebcam(front.deviceId);
              }, 300);
            }
          }
        } else if (attempt < 4) {
          setTimeout(() => fetchCameras(attempt + 1), 1000);
        }
      } catch (err) {
        if (!cancelled && attempt < 4) {
          setTimeout(() => fetchCameras(attempt + 1), 1000);
        }
      }
    };
    // iOS needs a longer delay — camera permission dialog can still be
    // showing at 800ms and getWebcams() returns empty until dismissed.
    const delay = Platform.OS === 'ios' ? 1200 : 800;
    const t = setTimeout(() => fetchCameras(), delay);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  useEffect(() => {
    if (bothParticipantsPresent && !bothJoinedAtRef.current) {
      bothJoinedAtRef.current = Date.now();
    }
  }, [bothParticipantsPresent]);

  // On first webcam-on: switch to front camera once.
  // cameraInitializedRef prevents re-entry — changeWebcam restarts the
  // camera stream internally, which briefly flips localWebcamOn off→on
  // and would trigger this effect again without the guard.
  useEffect(() => {
    if (!localWebcamOn || cameraInitializedRef.current) return;

    if (frontCameraIdRef.current) {
      cameraInitializedRef.current = true;
      if (shouldSelectFrontCameraOnInit()) {
        setTimeout(() => changeWebcam(frontCameraIdRef.current), 400);
      }
      return;
    }

    // IDs not loaded yet — enumerate now (fetchCameras hasn't finished).
    // Use ?.then() — getWebcams may be undefined on some SDK versions/platforms.
    getWebcams?.()
      ?.then(cams => {
        if (!cams?.length) return;
        const { front, back } = resolveCameras(cams);
        frontCameraIdRef.current = front?.deviceId ?? null;
        backCameraIdRef.current = back?.deviceId ?? null;
        if (front?.deviceId) {
          cameraInitializedRef.current = true;
          if (shouldSelectFrontCameraOnInit()) {
            setTimeout(() => changeWebcam(front.deviceId), 400);
          }
        }
      })
      ?.catch(() => {});
  }, [localWebcamOn]);

  const publishConsentMessage = (payload, persist = true) => {
    if (!localParticipantIdRef.current) {
      Toast.show("Still connecting — try again in a moment");
      return;
    }
    recordingConsentPubSub.publish(JSON.stringify(payload), { persist });
  };

  publishConsentMessageRef.current = publishConsentMessage;

  const startRecordingSession = useCallback(async () => {
    if (!isHostRef.current || !meetingIdRef.current) {
      return;
    }
    if (restRecordingActiveRef.current) {
      return;
    }
    const state = recordingStateRef.current;
    if (state && state !== Constants.recordingEvents.RECORDING_STOPPED) {
      return;
    }

    const mentorProfileId =
      bookingRef.current?.mentor_id || localParticipantIdRef.current;

    try {
      const token = await getToken();
      await startOneToOneRecordingViaAPI({
        token,
        meetingId: meetingIdRef.current,
        mentorId: mentorProfileId,
      });
      setRestRecordingActive(true);
      Toast.show('Recording started.');
    } catch (err) {
      console.error('[Recording] REST start failed, trying SDK fallback:', err);
      try {
        startOneToOneRecording(
          startRecordingRef.current,
          participantCountRef.current || 2,
        );
        setRestRecordingActive(true);
        Toast.show('Recording started.');
      } catch (fallbackErr) {
        console.error('[Recording] start failed:', fallbackErr);
        Toast.show('Could not start recording');
        throw fallbackErr;
      }
    }
  }, []);

  startRecordingSessionRef.current = startRecordingSession;

  const stopRecordingSession = useCallback(async () => {
    if (!isHostRef.current) {
      showMentorOnlyStopAlert({ present: showDeferredAlert });
      return;
    }
    if (!meetingIdRef.current) {
      return;
    }

    try {
      const token = await getToken();
      await stopOneToOneRecordingSession({
        token,
        meetingId: meetingIdRef.current,
        stopRecording: stopRecordingRef.current,
      });
      setRestRecordingActive(false);
      Toast.show('Recording stopped.');
    } catch (err) {
      console.error('[Recording] stop failed:', err);
      Toast.show('Could not stop recording');
    }
  }, []);

  const confirmStopRecording = () => {
    showStopRecordingAlert({
      present: showDeferredAlert,
      onStop: () => stopRecordingSession(),
    });
  };

  const showIncomingRecordingConsent = (requestId, requesterRole) => {
    if (incomingConsentRequestIdRef.current === requestId) {
      return;
    }
    incomingConsentRequestIdRef.current = requestId;

    showIncomingRecordingConsentAlert({
      requesterRole,
      present: showDeferredAlert,
      onDecline: () => {
        incomingConsentRequestIdRef.current = null;
        publishConsentMessage({
          type: "RECORDING_CONSENT_RESPONSE",
          requestId,
          agreed: false,
          responderId: localParticipantId,
          ts: Date.now(),
        });
      },
      onAgree: () => {
        incomingConsentRequestIdRef.current = null;
        publishConsentMessage({
          type: "RECORDING_CONSENT_RESPONSE",
          requestId,
          agreed: true,
          responderId: localParticipantId,
          ts: Date.now(),
        });
        Toast.show('Thanks — starting recording once both agree');
      },
    });
  };

  showIncomingRecordingConsentRef.current = showIncomingRecordingConsent;

  const requestRecordingConsent = () => {
    if (!bothParticipantsPresent) {
      showWaitForPeerAlert({ present: showDeferredAlert });
      return;
    }
    if (!localParticipantId) {
      Toast.show('Connecting… please try again in a moment');
      return;
    }

    showRequestRecordingConsentAlert({
      present: showDeferredAlert,
      onRequest: () => {
        const requestId = `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;
        pendingRecordingRequestRef.current = requestId;
        publishConsentMessage({
          type: "RECORDING_CONSENT_REQUEST",
          requestId,
          requesterId: localParticipantId,
          requesterRole: isHost ? "Mentor" : "Learner",
          ts: Date.now(),
        });
        Toast.show('Request sent — waiting for their response');
      },
    });
  };

  useEffect(() => {
    if (
      !isHost ||
      !autoStartRecording ||
      !recordingRequestedAtBooking ||
      !bothParticipantsPresent ||
      !localParticipantId ||
      !meetingId ||
      autoRecordingAttemptedRef.current
    ) {
      return;
    }

    autoRecordingAttemptedRef.current = true;
    Toast.show('You both agreed — recording is starting…');
    startRecordingSession().catch(() => {
      autoRecordingAttemptedRef.current = false;
    });
  }, [
    autoStartRecording,
    recordingRequestedAtBooking,
    bothParticipantsPresent,
    isHost,
    meetingId,
    localParticipantId,
    startRecordingSession,
  ]);

  useEffect(() => {
    if (recordingState === Constants.recordingEvents.RECORDING_STOPPED) {
      setRestRecordingActive(false);
    }
  }, [recordingState]);

  useEffect(() => {
    if (Platform.OS === "ios") {
      const subscription = VideosdkRPK.addListener("onScreenShare", (event) => {
        if (event === "START_BROADCAST") {
          enableScreenShare();
        } else if (event === "STOP_BROADCAST") {
          disableScreenShare();
        }
      });

      return () => {
        subscription?.remove?.();
      };
    }
  }, [enableScreenShare, disableScreenShare]);

  useEffect(() => {
    if (!recordingRef.current) return;

    const shouldBlink =
      restRecordingActive ||
      recordingState === Constants.recordingEvents.RECORDING_STARTED ||
      recordingState === Constants.recordingEvents.RECORDING_STARTING ||
      recordingState === Constants.recordingEvents.RECORDING_STOPPING;

    if (shouldBlink) {
      recordingRef.current.start();
    } else {
      recordingRef.current.stop();
    }
  }, [recordingState, restRecordingActive]);

  const isRecordingVisible =
    restRecordingActive ||
    recordingState === Constants.recordingEvents.RECORDING_STARTED ||
    recordingState === Constants.recordingEvents.RECORDING_STOPPING ||
    recordingState === Constants.recordingEvents.RECORDING_STARTING;

  const isRecordingRunning =
    restRecordingActive ||
    recordingState === Constants.recordingEvents.RECORDING_STARTED;

  const openChatPanel = () => {
    setchatViewer(true);
    setparticipantListViewer(false);
    setparticipantStatsViewer(false);
    bottomSheetRef.current?.show();
  };

  const { popup: chatPopup, unreadCount, dismissPopup, openChatFromPopup } =
    useInCallChatPopup({
      localParticipantId,
      isChatOpen: chatViewer,
      onOpenChat: openChatPanel,
    });

  const openStatsBottomSheet = useCallback(({ pId }) => {
    setparticipantStatsViewer(true);
    setstatParticipantId(pId);
    bottomSheetRef.current?.show?.();
  }, []);

  // Flip between front and back using cached IDs — no enumeration delay.
  const handleFlipCamera = () => {
    const current = activeCameraRef.current;
    const frontId = frontCameraIdRef.current;
    const backId = backCameraIdRef.current;

    if (current === 'front') {
      if (backId) {
        changeWebcam(backId);
        activeCameraRef.current = 'back';
      } else {
        changeWebcam();
        activeCameraRef.current = 'back';
      }
    } else {
      if (frontId) {
        changeWebcam(frontId);
        activeCameraRef.current = 'front';
      } else {
        changeWebcam();
        activeCameraRef.current = 'front';
      }
    }
  };

  const MIN_SESSION_SECONDS = 300; // 5 minutes minimum session


  const tryLeave = (endForAll = false) => {
    if (endForAll) {
      onSessionEnding?.();
      end();
      return;
    }
    exitMeeting();
  };

  const confirmLeaveMeeting = () => {
    showDeferredAlert(
      'Leave meeting?',
      'Are you sure you want to leave this meeting?',
      [
        { text: 'Stay in meeting', style: 'cancel' },
        { text: 'Leave meeting', style: 'destructive', onPress: () => exitMeeting() },
      ],
      { cancelable: true },
    );
  };

  useEffect(() => {
    const onBackPress = () => {
      confirmLeaveMeeting();
      return true;
    };

    const backHandlerSubscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress
    );

    return () => backHandlerSubscription.remove();
  }, [exitMeeting]);

  useBackgroundWebcamRestore({
    localWebcamOn,
    toggleWebcam,
    changeWebcam,
    frontCameraIdRef,
    onBackgroundLeave: () => {
      Toast.show('Session ended — app was in background too long');
      exitMeeting();
    },
  });

  if (!localParticipantId) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.primary[900],
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <CosmicLoader size={56} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.primary[900] }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          width: "100%",
          paddingHorizontal: 8,
        }}
      >
        {isRecordingVisible ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.dangerBg,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
            }}
          >
            <Blink ref={recordingRef} duration={500}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.dangerSolid,
                }}
              />
            </Blink>
            <Text
              style={{
                marginLeft: 6,
                color: colors.dangerText,
                fontFamily: ROBOTO_FONTS.RobotoBold,
                fontSize: 12,
                letterSpacing: 0.5,
              }}
            >
              REC
            </Text>
          </View>
        ) : null}
        <View
          style={{
            flex: 1,
            justifyContent: "space-between",
            marginLeft: isRecordingVisible ? 8 : 0,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <CallSessionTimer slot={slot} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <TouchableOpacity
            onPress={() => setViewLayout(layout => (layout === 'split' ? 'pip' : 'split'))}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <View style={{ width: 26, height: 26, justifyContent: 'center', alignItems: 'center' }}>
              {viewLayout === 'split' ? (
                <View style={{ width: 24, height: 24, position: 'relative' }}>
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 1.5, borderColor: colors.primary[100], borderRadius: 3 }} />
                  <View style={{ position: 'absolute', bottom: 2, right: 2, width: 10, height: 8, backgroundColor: colors.primary[100], borderRadius: 2 }} />
                </View>
              ) : (
                <View style={{ width: 24, height: 24, flexDirection: 'column', gap: 2 }}>
                  <View style={{ flex: 1, borderWidth: 1.5, borderColor: colors.primary[100], borderRadius: 3 }} />
                  <View style={{ flex: 1, borderWidth: 1.5, borderColor: colors.primary[100], borderRadius: 3 }} />
                </View>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleFlipCamera}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <CameraSwitch height={26} width={26} fill={colors.primary[100]} />
          </TouchableOpacity>
        </View>
      </View>
      {/* Center */}
      <View style={{ flex: 1, marginTop: 2, marginBottom: 2, overflow: 'hidden' }}>
        <OneToOneCallLayout
          participantCount={participantCount}
          viewLayout={viewLayout}
          isLandscape={isLandscape}
          localParticipantId={localParticipantId}
          remoteParticipantId={remoteParticipantId}
          primaryParticipantId={primaryParticipantId}
          secondaryParticipantId={secondaryParticipantId}
          participantIds={participantIds}
          localDisplayName={localDisplayName}
          remoteDisplayName={remoteDisplayName}
          localScreenShareOn={localScreenShareOn}
          presenterId={presenterId}
          onSwapPrimary={handleSwapPrimary}
          openStatsBottomSheet={openStatsBottomSheet}
          miniViewHeight={isLandscape ? 110 : 160}
        />
      </View>
      <Menu
        ref={leaveMenu}
        menuBackgroundColor={colors.primary[700]}
        placement="left"
      >
        <MenuItem
          title={"Leave call"}
          onPress={() => {
            leaveMenu.current?.close();
            tryLeave(false);
          }}
        />
      </Menu>
      <Menu
        ref={audioDeviceMenuRef}
        menuBackgroundColor={colors.primary[700]}
        placement="left"
        left={70}
      >
        {audioDevice.map((device, index) => {
          return (
            <React.Fragment key={device}>
              <MenuItem
                title={
                  device == "SPEAKER_PHONE"
                    ? "Speaker"
                    : device == "EARPIECE"
                    ? "Earpiece"
                    : device == "BLUETOOTH"
                    ? "Bluetooth"
                    : "Wired Headset"
                }
                onPress={() => {
                  switchAudioDevice(device);
                  audioDeviceMenuRef.current.close();
                }}
              />

              {index != audioDevice.length - 1 && (
                <View
                  style={{
                    height: 1,
                    backgroundColor: colors.primary["600"],
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </Menu>
      <Menu
        ref={moreOptionsMenu}
        menuBackgroundColor={colors.sheet}
        placement="right"
      >
        {Boolean(booking?.id) ? (
          <>
            <MenuItem
              title={`${
                !isRecordingRunning &&
                (!recordingState ||
                  recordingState === Constants.recordingEvents.RECORDING_STOPPED)
                  ? "Start"
                  : recordingState === Constants.recordingEvents.RECORDING_STARTING
                  ? "Starting"
                  : recordingState === Constants.recordingEvents.RECORDING_STOPPING
                  ? "Stopping"
                  : "Stop"
              } Recording`}
              icon={<Recording width={22} height={22} fill={colors.primary[100]} />}
              onPress={() => {
                moreOptionsMenu.current.close();
                runAfterMenuDismiss(() => {
                  if (
                    !isRecordingRunning &&
                    (!recordingState ||
                      recordingState === Constants.recordingEvents.RECORDING_STOPPED)
                  ) {
                    requestRecordingConsent();
                    return;
                  }
                  if (isRecordingRunning) {
                    confirmStopRecording();
                    return;
                  }
                  if (
                    recordingState === Constants.recordingEvents.RECORDING_STARTING
                  ) {
                    Toast.show('Recording is starting…');
                  }
                });
              }}
            />
            <View
              style={{
                height: 1,
                backgroundColor: colors.primary["600"],
              }}
            />
          </>
        ) : null}
        {(presenterId == null || localScreenShareOn) && (
          <MenuItem
            title={`${localScreenShareOn ? "Stop" : "Start"} Screen Share`}
            icon={<ScreenShare width={22} height={22} fill={colors.primary[100]} />}
            onPress={() => {
              moreOptionsMenu.current.close();
              pressScreenShare({
                localScreenShareOn,
                presenterId,
                toggleScreenShare,
                disableScreenShare,
                afterDismiss: runAfterMenuDismiss,
              });
            }}
          />
        )}
        <View
          style={{
            height: 1,
            backgroundColor: colors.primary["600"],
          }}
        />
        <MenuItem
          title={"Participants"}
          icon={<Participants width={22} height={22} fill={colors.primary[100]} />}
          onPress={() => {
            setparticipantListViewer(true);
            moreOptionsMenu.current.close(false);
            bottomSheetRef.current.show();
          }}
        />
      </Menu>
      {/* Bottom */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-evenly",
          paddingBottom: Platform.OS === 'android' ? 8 : 4,
        }}
      >
        <IconContainer
          backgroundColor={"red"}
          onPress={confirmLeaveMeeting}
        >
          <CallEnd height={26} width={26} fill={colors.dangerSolidText} />
        </IconContainer>
        <View
          style={{
            flexDirection: "row",
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: colors.controlBorder,
            backgroundColor: !localMicOn ? colors.primary[100] : "transparent",
            height: 50,
            alignItems: "center",
          }}
        >
          <TouchableOpacity
            onPress={() => toggleMic()}
            style={{ width: 50, height: 50, justifyContent: "center", alignItems: "center" }}
          >
            {localMicOn
              ? <MicOn height={24} width={24} fill={colors.chromeInk} />
              : <MicOff height={28} width={28} fill={colors.ink} />}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              await updateAudioDeviceList();
              audioDeviceMenuRef.current.show();
            }}
            style={{ width: 30, height: 50, justifyContent: "center", alignItems: "center", paddingRight: 4 }}
          >
            <DownArrow fill={localMicOn ? colors.chromeInk : colors.ink} />
          </TouchableOpacity>
        </View>
        <IconContainer
          style={{ borderWidth: 1.5, borderColor: colors.controlBorder }}
          backgroundColor={!localWebcamOn ? colors.primary[100] : "transparent"}
          onPress={() => {
            if (!localWebcamOn) {
              toggleWebcam();
              if (shouldSelectFrontCameraOnInit()) {
                setTimeout(() => {
                  const id = frontCameraIdRef.current;
                  if (id) changeWebcam(id);
                  else changeWebcam();
                }, 400);
              }
            } else {
              toggleWebcam();
            }
          }}
        >
          {localWebcamOn
            ? <VideoOn height={24} width={24} fill={colors.chromeInk} />
            : <VideoOff height={36} width={36} fill={colors.ink} />}
        </IconContainer>
        <View style={{ position: 'relative' }}>
          <IconContainer
            onPress={openChatPanel}
            style={{ borderWidth: 1.5, borderColor: colors.controlBorder }}
          >
            <Chat height={22} width={22} fill={colors.chromeInk} />
          </IconContainer>
          {unreadCount > 0 ? (
            <View
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: colors.brand,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
              }}
            >
              <Text style={{ color: colors.onBrand, fontSize: 10, fontWeight: '700' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
        <IconContainer
          style={{
            borderWidth: 1.5,
            borderColor: colors.controlBorder,
            transform: [{ rotate: "90deg" }],
          }}
          onPress={() => moreOptionsMenu.current.show()}
        >
          <More height={18} width={18} fill={colors.chromeInk} />
        </IconContainer>
      </View>
      <BottomSheet
        sheetBackgroundColor={colors.sheet}
        draggable={true}
        radius={12}
        hasDraggableIcon
        closeFunction={() => {
          setparticipantListViewer(false);
          setchatViewer(false);
          setparticipantStatsViewer(false);
          setstatParticipantId("");
        }}
        ref={bottomSheetRef}
        height={Dimensions.get("window").height * 0.5}
      >
        {chatViewer ? (
          <ChatViewer />
        ) : participantListViewer ? (
          <ParticipantListViewer participantIds={participantIds} />
        ) : participantStatsViewer ? (
          <ParticipantStatsViewer participantId={statParticipantId} />
        ) : null}
      </BottomSheet>
      <ChatMessagePopup
        visible={!!chatPopup}
        senderName={chatPopup?.senderName}
        message={chatPopup?.message}
        onPress={openChatFromPopup}
        onDismiss={dismissPopup}
      />
    </View>
  );
}
