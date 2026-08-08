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
  StyleSheet,
  Animated,
  Pressable,
  StatusBar,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { useTheme, useThemedStyles } from "../../../hooks/useTheme";
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

// MeetingProvider joins with defaultCamera: 'front'. On iOS, changeWebcam()
// immediately after join restarts capture and can briefly go black — use a
// longer delay instead of skipping front selection entirely.
function getFrontCameraInitDelayMs() {
  return Platform.OS === 'ios' ? 1000 : 300;
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

const CHROME_AUTO_HIDE_MS = 4500;
const CHROME_ANIM_MS = 260;

export default function OneToOneMeetingViewer({
  isHost,
  booking,
  recordingRequested: recordingRequestedProp = false,
  autoStartRecording = false,
  onRequestLeave,
  onSessionEnding,
}) {
  const styles = useThemedStyles(createOneToOneStyles);
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [chromeVisible, setChromeVisible] = useState(true);
  const chromeAnim = useRef(new Animated.Value(1)).current;
  const chromeHideTimerRef = useRef(null);
  const chromeVisibleRef = useRef(true);

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
  const sheetOpen = chatViewer || participantListViewer || participantStatsViewer;

  const clearChromeHideTimer = useCallback(() => {
    if (chromeHideTimerRef.current) {
      clearTimeout(chromeHideTimerRef.current);
      chromeHideTimerRef.current = null;
    }
  }, []);

  const scheduleChromeHide = useCallback(() => {
    clearChromeHideTimer();
    if (sheetOpen) return;
    chromeHideTimerRef.current = setTimeout(() => {
      chromeHideTimerRef.current = null;
      chromeVisibleRef.current = false;
      setChromeVisible(false);
    }, CHROME_AUTO_HIDE_MS);
  }, [clearChromeHideTimer, sheetOpen]);

  const revealChrome = useCallback(() => {
    chromeVisibleRef.current = true;
    setChromeVisible(true);
    scheduleChromeHide();
  }, [scheduleChromeHide]);

  const toggleChrome = useCallback(() => {
    if (chromeVisibleRef.current) {
      clearChromeHideTimer();
      chromeVisibleRef.current = false;
      setChromeVisible(false);
      return;
    }
    revealChrome();
  }, [clearChromeHideTimer, revealChrome]);

  useEffect(() => {
    chromeVisibleRef.current = chromeVisible;
    Animated.timing(chromeAnim, {
      toValue: chromeVisible ? 1 : 0,
      duration: CHROME_ANIM_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [chromeVisible, chromeAnim]);

  useEffect(() => {
    if (sheetOpen) {
      clearChromeHideTimer();
      chromeVisibleRef.current = true;
      setChromeVisible(true);
      return undefined;
    }
    if (chromeVisibleRef.current) {
      scheduleChromeHide();
    }
    return clearChromeHideTimer;
  }, [sheetOpen, clearChromeHideTimer, scheduleChromeHide]);

  useEffect(() => () => clearChromeHideTimer(), [clearChromeHideTimer]);

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
            if (front?.deviceId) {
              setTimeout(() => {
                if (!cancelled) changeWebcam(front.deviceId);
              }, getFrontCameraInitDelayMs());
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

    const delayMs = getFrontCameraInitDelayMs();

    if (frontCameraIdRef.current) {
      cameraInitializedRef.current = true;
      setTimeout(() => changeWebcam(frontCameraIdRef.current), delayMs);
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
          setTimeout(() => changeWebcam(front.deviceId), delayMs);
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
    if (!recordingRequestedAtBooking) {
      Toast.show('Recording was not requested for this booking');
      return;
    }
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
  const slotEndedHandledRef = useRef(false);

  const tryLeave = (endForAll = false) => {
    if (endForAll) {
      onSessionEnding?.();
      try {
        end();
      } catch (_) {}
      // Always exit locally — end() may be host-only on some SDK builds.
      exitMeeting();
      return;
    }
    exitMeeting();
  };

  /** Slot countdown hit 00:00 — tear down the room for everyone. */
  const handleSlotTimerEnded = useCallback(() => {
    if (slotEndedHandledRef.current) {
      return;
    }
    slotEndedHandledRef.current = true;
    Toast.show('Session time is over');
    onSessionEnding?.();
    try {
      end();
    } catch (_) {}
    exitMeeting();
  }, [end, exitMeeting, onSessionEnding]);

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

  const peerLabel = isHost ? 'learner' : 'mentor';
  const waitingForPeer = participantCount < 2 && !presenterId;
  const miniViewHeight = isLandscape ? 120 : Platform.OS === 'ios' ? 148 : 160;
  const pipReserve =
    (Platform.OS === 'ios' ? 28 : 20) + Math.max(insets.bottom, 0);
  const showPipHole = viewLayout === 'pip' && participantCount > 1 && !presenterId;

  const headerAnimatedStyle = {
    opacity: chromeAnim,
    transform: [
      {
        translateY: chromeAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-18, 0],
        }),
      },
    ],
  };
  const dockAnimatedStyle = {
    opacity: chromeAnim,
    transform: [
      {
        translateY: chromeAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [28, 0],
        }),
      },
    ],
  };

  return (
    <View style={styles.root}>
      <StatusBar
        animated
        barStyle={isDark ? 'light-content' : 'dark-content'}
        translucent={Platform.OS === 'android'}
        backgroundColor="transparent"
      />

      <View style={styles.videoStage} pointerEvents="box-none">
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
          miniViewHeight={miniViewHeight}
          miniViewBottomInset={Math.max(insets.bottom, Platform.OS === 'ios' ? 8 : 0)}
          waitingForPeer={waitingForPeer}
          waitingPeerLabel={peerLabel}
        />
      </View>

      {/*
        Tap layer sits above native RTC views. On iOS, RTCView otherwise
        swallows touches so Pressable wrappers never fire.
        Near-opaque fill is required for iOS hit-testing.
        PiP corner is left open so swap / stats still work.
      */}
      <View style={styles.tapLayer} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={chromeVisible ? 'Hide call controls' : 'Show call controls'}
          onPress={toggleChrome}
          style={[
            styles.tapCatcher,
            showPipHole ? { bottom: miniViewHeight + pipReserve } : null,
          ]}
        />
        {showPipHole ? (
          <View
            style={[styles.tapBottomRow, { height: miniViewHeight + pipReserve }]}
            pointerEvents="box-none"
          >
            <Pressable style={styles.tapCatcherFlex} onPress={toggleChrome} />
            <View
              pointerEvents="none"
              style={{ width: miniViewHeight * 0.72 + pipReserve }}
            />
          </View>
        ) : null}
      </View>

      <Animated.View
        pointerEvents={chromeVisible ? 'box-none' : 'none'}
        style={[
          styles.header,
          {
            paddingTop: Math.max(
              insets.top,
              Platform.OS === 'ios' ? 12 : 4,
            ),
          },
          headerAnimatedStyle,
        ]}
      >
        <View style={styles.headerLeft}>
          {isRecordingVisible ? (
            <View style={styles.recBadge}>
              <Blink ref={recordingRef} duration={500}>
                <View style={styles.recDot} />
              </Blink>
              <Text style={styles.recLabel}>REC</Text>
            </View>
          ) : null}
          <CallSessionTimer slot={slot} onSlotEnded={handleSlotTimerEnded} />
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => {
              revealChrome();
              setViewLayout(layout => (layout === 'split' ? 'pip' : 'split'));
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.headerIconBtn}
            accessibilityLabel={viewLayout === 'split' ? 'Switch to picture-in-picture' : 'Switch to split view'}
          >
            {viewLayout === 'split' ? (
              <View style={styles.layoutIconPip}>
                <View style={styles.layoutIconPipFrame} />
                <View style={styles.layoutIconPipInset} />
              </View>
            ) : (
              <View style={styles.layoutIconSplit}>
                <View style={styles.layoutIconSplitPane} />
                <View style={styles.layoutIconSplitPane} />
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              revealChrome();
              handleFlipCamera();
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.headerIconBtn}
            accessibilityLabel="Flip camera"
          >
            <CameraSwitch height={22} width={22} fill={colors.chromeInk} />
          </TouchableOpacity>
        </View>
      </Animated.View>

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
                    if (!recordingRequestedAtBooking) {
                      Toast.show('Recording was not requested for this booking');
                      return;
                    }
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

      <Animated.View
        pointerEvents={chromeVisible ? 'box-none' : 'none'}
        style={[
          styles.controlDock,
          { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 10 : 12) },
          dockAnimatedStyle,
        ]}
      >
        <View style={styles.controlDockEdge} />
        <View style={styles.controlRow}>
          <IconContainer
            backgroundColor={colors.dangerSolid}
            onPress={() => {
              revealChrome();
              confirmLeaveMeeting();
            }}
            style={styles.endCallBtn}
          >
            <CallEnd height={24} width={24} fill={colors.dangerSolidText} />
          </IconContainer>
          <View
            style={[
              styles.micCluster,
              !localMicOn && styles.controlActiveFill,
            ]}
          >
            <TouchableOpacity
              onPress={() => {
                revealChrome();
                toggleMic();
              }}
              style={styles.micMain}
              accessibilityLabel={localMicOn ? 'Mute microphone' : 'Unmute microphone'}
            >
              {localMicOn
                ? <MicOn height={22} width={22} fill={colors.chromeInk} />
                : <MicOff height={22} width={22} fill={colors.ink} />}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                revealChrome();
                await updateAudioDeviceList();
                audioDeviceMenuRef.current.show();
              }}
              style={styles.micChevron}
              accessibilityLabel="Choose audio output"
            >
              <DownArrow fill={localMicOn ? colors.chromeInk : colors.ink} />
            </TouchableOpacity>
          </View>
          <IconContainer
            style={[styles.controlOutline, !localWebcamOn && styles.controlActiveFill]}
            backgroundColor={!localWebcamOn ? colors.primary[100] : 'transparent'}
            onPress={() => {
              revealChrome();
              if (!localWebcamOn) {
                toggleWebcam();
                setTimeout(() => {
                  const id = frontCameraIdRef.current;
                  if (id) changeWebcam(id);
                  else changeWebcam();
                }, getFrontCameraInitDelayMs());
              } else {
                toggleWebcam();
              }
            }}
          >
            {localWebcamOn
              ? <VideoOn height={22} width={22} fill={colors.chromeInk} />
              : <VideoOff height={22} width={22} fill={colors.ink} />}
          </IconContainer>
          <View style={styles.chatWrap}>
            <IconContainer
              onPress={() => {
                revealChrome();
                openChatPanel();
              }}
              style={styles.controlOutline}
            >
              <Chat height={22} width={22} fill={colors.chromeInk} />
            </IconContainer>
            {unreadCount > 0 ? (
              <View style={styles.chatBadge}>
                <Text style={styles.chatBadgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            ) : null}
          </View>
          <IconContainer
            style={[styles.controlOutline, styles.moreBtn]}
            onPress={() => {
              revealChrome();
              moreOptionsMenu.current.show();
            }}
          >
            <More height={18} width={18} fill={colors.chromeInk} />
          </IconContainer>
        </View>
      </Animated.View>

      <BottomSheet
        sheetBackgroundColor={colors.sheet}
        draggable={true}
        radius={16}
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

function createOneToOneStyles(theme) {
  const M = theme.colors.meeting;
  const B = theme.colors.buttons;
  const brand = theme.colors.component.button;
  const onBrand = theme.colors.text.onAccent;
  const isLight = theme.mode === 'light';
  /** Elevated chrome controls (header buttons) — not video-tile black. */
  const chromeControl = M.sheet;
  const chromeOverlay = isLight
    ? 'rgba(248, 249, 255, 0.92)'
    : 'rgba(0, 0, 8, 0.78)';

  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: M[800],
    },
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 30,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingBottom: 10,
      minHeight: 48,
      backgroundColor: chromeOverlay,
    },
    headerLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginRight: 8,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    headerIconBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: chromeControl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: M.controlBorder,
    },
    layoutIconPip: {
      width: 20,
      height: 20,
      position: 'relative',
    },
    layoutIconPipFrame: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderWidth: 1.5,
      borderColor: M[100],
      borderRadius: 3,
    },
    layoutIconPipInset: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 8,
      height: 6,
      backgroundColor: M[100],
      borderRadius: 1.5,
    },
    layoutIconSplit: {
      width: 20,
      height: 20,
      flexDirection: 'column',
      gap: 2,
    },
    layoutIconSplitPane: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: M[100],
      borderRadius: 3,
    },
    recBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: B.dangerBg,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
    },
    recDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: B.dangerSolid,
    },
    recLabel: {
      marginLeft: 6,
      color: B.dangerText,
      fontFamily: ROBOTO_FONTS.RobotoBold,
      fontSize: 11,
      letterSpacing: 0.8,
    },
    videoStage: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: M[800],
    },
    tapLayer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 10,
    },
    tapCatcher: {
      ...StyleSheet.absoluteFillObject,
      // iOS ignores hit-testing on fully transparent views.
      backgroundColor: 'rgba(0,0,0,0.001)',
    },
    tapBottomRow: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    tapCatcherFlex: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.001)',
    },
    controlDock: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 30,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: M.controlBorder,
      backgroundColor: chromeOverlay,
      paddingTop: 12,
      paddingHorizontal: 10,
    },
    controlDockEdge: {
      position: 'absolute',
      top: 0,
      left: 16,
      right: 16,
      height: StyleSheet.hairlineWidth,
      backgroundColor: brand,
      opacity: 0.35,
    },
    controlRow: {
      flexDirection: 'row',
      justifyContent: 'space-evenly',
      alignItems: 'center',
    },
    endCallBtn: {
      borderRadius: 16,
    },
    micCluster: {
      flexDirection: 'row',
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: M.controlBorder,
      backgroundColor: 'transparent',
      height: 50,
      alignItems: 'center',
    },
    controlActiveFill: {
      backgroundColor: M[100],
    },
    micMain: {
      width: 48,
      height: 50,
      justifyContent: 'center',
      alignItems: 'center',
    },
    micChevron: {
      width: 28,
      height: 50,
      justifyContent: 'center',
      alignItems: 'center',
      paddingRight: 4,
    },
    controlOutline: {
      borderWidth: 1.5,
      borderColor: M.controlBorder,
      borderRadius: 16,
    },
    chatWrap: {
      position: 'relative',
    },
    chatBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: brand,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    chatBadgeText: {
      color: onBrand,
      fontSize: 10,
      fontWeight: '700',
    },
    moreBtn: {
      transform: [{ rotate: '90deg' }],
    },
  });
}
