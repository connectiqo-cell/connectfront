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
} from "../../../utils/recordingConfig";
import { getToken } from "../../../api/api";
import { computeSessionTiming, formatCountdown } from "../../../utils/sessionSlotTimer";
import { useBackgroundWebcamRestore } from "../../../hooks/useBackgroundWebcamRestore";
import { useInCallChatPopup } from "../../../hooks/useInCallChatPopup";
import { useOrientation } from "../../../utils/useOrientation";
import { pressScreenShare } from "../../../utils/screenShareActions";

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

// iOS silently drops Alert.alert while a Modal (e.g. the More menu) is still visible.
function runAfterMenuDismiss(action) {
  if (Platform.OS === "ios") {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(action, 350);
    });
    return;
  }
  action();
}

function showDeferredAlert(title, message, buttons, options) {
  runAfterMenuDismiss(() => Alert.alert(title, message, buttons, options));
}

export default function OneToOneMeetingViewer({
  isHost,
  booking,
  autoStartRecording = false,
  onRequestLeave,
  onSessionEnding,
}) {
  const onMeetingError = useCallback((data) => {
    const { code, message } = data;
    Toast.show(`Error: ${code}: ${message}`);
  }, []);

  const {
    join,
    participants,
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
    meeting,
    recordingState,
    enableScreenShare,
    disableScreenShare,
  } = useMeeting({ onError: onMeetingError });
  const exitMeeting = onRequestLeave || leave;
  const recordingConsentPubSub = usePubSub("RECORDING_CONSENT", {});

  const leaveMenu = useRef();
  const bottomSheetRef = useRef();
  const audioDeviceMenuRef = useRef();
  const moreOptionsMenu = useRef();
  const recordingRef = useRef();
  const processedConsentMessagesRef = useRef(new Set());
  const localParticipantIdRef = useRef(null);
  const pendingRecordingRequestRef = useRef(null);
  const autoRecordingAttemptedRef = useRef(false);
  const meetingTimerRef = useRef(null);
  const meetingStartedAtRef = useRef(null);
  const bothJoinedAtRef = useRef(null);
  const frontCameraIdRef = useRef(null);
  const backCameraIdRef = useRef(null);
  const activeCameraRef = useRef('front');
  const localWebcamOnRef = useRef(localWebcamOn);
  const cameraInitializedRef = useRef(false);

  const participantIds = [...participants.keys()];
  const localParticipantId = meeting?.localParticipant?.id;
  const remoteParticipantId =
    participantIds.find((id) => id !== localParticipantId) ??
    participantIds[1];

  // VideoSDK participants map is remote-only; +1 includes the local participant.
  const remoteParticipantCount = participants.size;
  const participantCount = remoteParticipantCount + 1;
  const bothParticipantsPresent = remoteParticipantCount >= 1;

  const localDisplayName = (meeting?.localParticipant?.displayName || '').split(' ')[0];
  const remoteDisplayName = (participants.get(remoteParticipantId)?.displayName || '').split(' ')[0];

  const [viewLayout, setViewLayout] = useState('split');
  const [primaryParticipantId, setPrimaryParticipantId] = useState(null);
  const orientation = useOrientation();
  const isLandscape = orientation === 'LANDSCAPE';
  const [chatViewer, setchatViewer] = useState(false);
  const [participantListViewer, setparticipantListViewer] = useState(false);
  const [participantStatsViewer, setparticipantStatsViewer] = useState(false);

  const [audioDevice, setAudioDevice] = useState([]);
  const [statParticipantId, setstatParticipantId] = useState("");
  const [meetingElapsedSeconds, setMeetingElapsedSeconds] = useState(0);
  const [restRecordingActive, setRestRecordingActive] = useState(false);
  const slot = booking?.availability_slots || {};
  const [sessionTiming, setSessionTiming] = useState(() => computeSessionTiming(slot));

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

  const handleSwapPrimary = () => {
    if (secondaryParticipantId) {
      setPrimaryParticipantId(secondaryParticipantId);
    }
  };

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
        console.warn('[Camera][' + Platform.OS + '] getWebcams result:', JSON.stringify(cams));
        if (cams?.length) {
          const { front, back } = resolveCameras(cams);
          frontCameraIdRef.current = front?.deviceId ?? null;
          backCameraIdRef.current = back?.deviceId ?? null;
          console.warn('[Camera] front:', front?.deviceId, front?.facingMode, '| back:', back?.deviceId, back?.facingMode);

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
        console.warn('[Camera] fetchCameras error:', err);
        if (!cancelled && attempt < 4) {
          setTimeout(() => fetchCameras(attempt + 1), 1000);
        }
      }
    };
    // iOS needs a longer delay — camera permission dialog can still be
    // showing at 800ms and getWebcams() returns empty until dismissed.
    const delay = Platform.OS === 'ios' ? 2500 : 800;
    const t = setTimeout(() => fetchCameras(), delay);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  useEffect(() => {
    if (bothParticipantsPresent && !bothJoinedAtRef.current) {
      bothJoinedAtRef.current = Date.now();
    }
  }, [bothParticipantsPresent]);

  useEffect(() => {
    meetingStartedAtRef.current = Date.now();
    setMeetingElapsedSeconds(0);
    meetingTimerRef.current = setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - meetingStartedAtRef.current) / 1000
      );
      setMeetingElapsedSeconds(elapsed);
    }, 1000);

    return () => {
      if (meetingTimerRef.current) {
        clearInterval(meetingTimerRef.current);
        meetingTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!slot.date) return undefined;
    const update = () => setSessionTiming(computeSessionTiming(slot));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [slot.date, slot.start_time, slot.end_time]);

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

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const publishConsentMessage = (payload, persist = true) => {
    recordingConsentPubSub.publish(JSON.stringify(payload), { persist });
  };

  const showIncomingRecordingConsent = (requestId, requesterRole) => {
    showDeferredAlert(
      "Recording Request",
      `${requesterRole} wants to record this session. Do you agree?`,
      [
        {
          text: "Disagree",
          style: "cancel",
          onPress: () => {
            publishConsentMessage({
              type: "RECORDING_CONSENT_RESPONSE",
              requestId,
              agreed: false,
              responderId: localParticipantIdRef.current,
              ts: Date.now(),
            });
            Toast.show("Recording consent declined");
          },
        },
        {
          text: "Agree",
          onPress: () => {
            publishConsentMessage({
              type: "RECORDING_CONSENT_RESPONSE",
              requestId,
              agreed: true,
              responderId: localParticipantIdRef.current,
              ts: Date.now(),
            });
            Toast.show("Recording consent shared");
          },
        },
      ],
      { cancelable: false }
    );
  };

  const requestRecordingConsent = () => {
    if (booking?.recording_requested !== true) {
      Alert.alert(
        "Recording unavailable",
        "The learner did not request a recording when this session was booked."
      );
      return;
    }
    if (!bothParticipantsPresent) {
      Toast.show("Wait for the other participant to join");
      return;
    }

    Alert.alert(
      "Record Session",
      "Do you want to request recording permission?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Request",
          onPress: () => {
            const requestId = `${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 8)}`;
            pendingRecordingRequestRef.current = requestId;
            publishConsentMessage({
              type: "RECORDING_CONSENT_REQUEST",
              requestId,
              requesterId: localParticipantIdRef.current,
              requesterRole: isHost ? "Mentor" : "Learner",
              ts: Date.now(),
            });
            Toast.show("Consent request sent");
          },
        },
      ],
      { cancelable: false }
    );
  };

  useEffect(() => {
    if (
      !isHost ||
      !autoStartRecording ||
      booking?.recording_requested !== true ||
      !bothParticipantsPresent ||
      !meetingId ||
      autoRecordingAttemptedRef.current
    ) {
      return;
    }

    autoRecordingAttemptedRef.current = true;
    Toast.show("Both participants agreed. Starting recording...");

    getToken()
      .then(token => startOneToOneRecordingViaAPI({
        token,
        meetingId,
        mentorId: localParticipantIdRef.current,
      }))
      .then(() => {
        setRestRecordingActive(true);
        Toast.show("Recording started.");
      })
      .catch(err => {
        console.error('[Recording] automatic REST start failed, trying SDK fallback:', err);
        try {
          startOneToOneRecording(startRecording, participantCount || 2);
          Toast.show("Recording started.");
        } catch (fallbackErr) {
          autoRecordingAttemptedRef.current = false;
          console.error('[Recording] automatic start failed:', fallbackErr);
          Toast.show('Could not start recording');
        }
      });
  }, [
    autoStartRecording,
    booking?.recording_requested,
    bothParticipantsPresent,
    isHost,
    meetingId,
    participantCount,
    startRecording,
  ]);

  useEffect(() => {
    const messages = recordingConsentPubSub.messages || [];
    if (!messages.length) return;

    messages.forEach((entry) => {
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

      // Host must process RECORDING_START_APPROVED even when it sent the message itself
      // (when mentor initiates: mentor publishes APPROVED, so senderId === localId)
      if (payload.type === "RECORDING_START_APPROVED" && isHost) {
        if (
          (!recordingState ||
            recordingState === Constants.recordingEvents.RECORDING_STOPPED) &&
          !restRecordingActive
        ) {
          getToken()
            .then(token => startOneToOneRecordingViaAPI({ token, meetingId, mentorId: localParticipantIdRef.current }))
            .then(() => {
              setRestRecordingActive(true);
              Toast.show("Recording started.");
            })
            .catch(err => {
              console.error('[Recording] REST start failed, trying SDK fallback:', err);
              try {
                startOneToOneRecording(startRecording, participantCount || 2);
                Toast.show('Recording started.');
              } catch (fallbackErr) {
                console.error('[Recording] start failed:', fallbackErr);
                Toast.show('Rec error: ' + (fallbackErr?.message || String(fallbackErr)));
              }
            });
        }
        return;
      }

      // Skip own messages for all other message types
      if (entry.senderId === localParticipantIdRef.current) {
        return;
      }

      if (
        payload.type === "RECORDING_CONSENT_REQUEST" &&
        payload.requesterId !== localParticipantIdRef.current
      ) {
        showIncomingRecordingConsent(payload.requestId, payload.requesterRole);
        return;
      }

      if (payload.type === "RECORDING_CONSENT_RESPONSE") {
        if (payload.requestId !== pendingRecordingRequestRef.current) {
          return;
        }
        if (payload.agreed) {
          publishConsentMessage({
            type: "RECORDING_START_APPROVED",
            requestId: payload.requestId,
            requesterId: localParticipantIdRef.current,
            ts: Date.now(),
          });
          Toast.show("Both agreed. Starting recording...");
        } else {
          Toast.show("Other participant declined recording.");
        }
        pendingRecordingRequestRef.current = null;
        return;
      }
    });
  }, [recordingConsentPubSub.messages, isHost, recordingState, meetingId, participantCount, startRecording]);

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

  useEffect(() => {
    return () => {
      if (meetingTimerRef.current) {
        clearInterval(meetingTimerRef.current);
      }
    };
  }, []);

  const hasSlotTimer = Boolean(slot.date);
  const reverseTimerValue = hasSlotTimer
    ? sessionTiming.status === "upcoming"
      ? formatCountdown(sessionTiming.untilStartSec)
      : sessionTiming.status === "live"
        ? formatCountdown(sessionTiming.remainingSec)
        : "00:00"
    : formatDuration(meetingElapsedSeconds);
  const reverseTimerLabel = hasSlotTimer
    ? sessionTiming.status === "upcoming"
      ? "Starts in"
      : sessionTiming.status === "live"
        ? "Time left"
        : "Ended"
    : null;
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

  const openStatsBottomSheet = ({ pId }) => {
    setparticipantStatsViewer(true);
    setstatParticipantId(pId);
    bottomSheetRef.current.show();
  };

  // Flip between front and back using cached IDs — no enumeration delay.
  const handleFlipCamera = () => {
    const current = activeCameraRef.current;
    const frontId = frontCameraIdRef.current;
    const backId = backCameraIdRef.current;
    console.warn('[Camera] flip pressed — current:', current, '| frontId:', frontId, '| backId:', backId);

    if (current === 'front') {
      if (backId) {
        console.warn('[Camera] switching to back:', backId);
        changeWebcam(backId);
        activeCameraRef.current = 'back';
      } else {
        console.warn('[Camera] no backId — calling changeWebcam() no-args');
        changeWebcam();
        activeCameraRef.current = 'back';
      }
    } else {
      if (frontId) {
        console.warn('[Camera] switching to front:', frontId);
        changeWebcam(frontId);
        activeCameraRef.current = 'front';
      } else {
        console.warn('[Camera] no frontId — calling changeWebcam() no-args');
        changeWebcam();
        activeCameraRef.current = 'front';
      }
    }
  };

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
              backgroundColor: "rgba(239, 68, 68, 0.2)",
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
                  backgroundColor: "#ef4444",
                }}
              />
            </Blink>
            <Text
              style={{
                marginLeft: 6,
                color: "#fca5a5",
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
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                marginRight: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                minWidth: hasSlotTimer ? 108 : undefined,
              }}
            >
              {hasSlotTimer && sessionTiming.status === "live" ? (
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: "#4ade80",
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
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {reverseTimerValue}
                </Text>
              </View>
            </View>
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
        menuBackgroundColor={colors.primary[700]}
        placement="right"
      >
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
              : "Recording"
          } Recording`}
          icon={<Recording width={22} height={22} />}
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
              Toast.show("Recording stops when the meeting ends");
            });
          }}
        />
        <View
          style={{
            height: 1,
            backgroundColor: colors.primary["600"],
          }}
        />
        {(presenterId == null || localScreenShareOn) && (
          <MenuItem
            title={`${localScreenShareOn ? "Stop" : "Start"} Screen Share`}
            icon={<ScreenShare width={22} height={22} />}
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
          icon={<Participants width={22} height={22} />}
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
          <CallEnd height={26} width={26} fill="#FFF" />
        </IconContainer>
        <View
          style={{
            flexDirection: "row",
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: colors.sheet,
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
              ? <MicOn height={24} width={24} fill={colors.primary[100]} />
              : <MicOff height={28} width={28} fill={colors.ink} />}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              await updateAudioDeviceList();
              audioDeviceMenuRef.current.show();
            }}
            style={{ width: 30, height: 50, justifyContent: "center", alignItems: "center", paddingRight: 4 }}
          >
            <DownArrow />
          </TouchableOpacity>
        </View>
        <IconContainer
          style={{ borderWidth: 1.5, borderColor: colors.sheet }}
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
            ? <VideoOn height={24} width={24} fill={colors.primary[100]} />
            : <VideoOff height={36} width={36} fill={colors.ink} />}
        </IconContainer>
        <View style={{ position: 'relative' }}>
          <IconContainer
            onPress={openChatPanel}
            style={{ borderWidth: 1.5, borderColor: colors.sheet }}
          >
            <Chat height={22} width={22} fill={colors.primary[100]} />
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
                backgroundColor: '#7c3aed',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
        <IconContainer
          style={{
            borderWidth: 1.5,
            borderColor: colors.sheet,
            transform: [{ rotate: "90deg" }],
          }}
          onPress={() => moreOptionsMenu.current.show()}
        >
          <More height={18} width={18} fill={colors.primary[100]} />
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
