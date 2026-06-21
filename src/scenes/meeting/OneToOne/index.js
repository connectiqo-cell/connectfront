import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Platform,
  Alert,
  BackHandler,
  AppState,
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
import LocalViewContainer from "./LocalViewContainer";
import LargeView from "./LargeView";
import MiniView from "./MiniView";
import LocalParticipantPresenter from "../Components/LocalParticipantPresenter";
import Menu from "../../../components/Menu";
import MenuItem from "../Components/MenuItem";
import { ROBOTO_FONTS } from "../../../styles/fonts";
import Toast from "react-native-simple-toast";
import BottomSheet from "../../../components/BottomSheet";
import ParticipantListViewer from "../Components/ParticipantListViewer";
import ChatViewer from "../Components/ChatViewer";
import Blink from "../../../components/Blink";
import VideosdkRPK from "../../../../VideosdkRPK";
import ParticipantStatsViewer from "../Components/ParticipantStatsViewer";
import { startOneToOneRecording } from "../../../utils/recordingConfig";
import { computeSessionTiming, formatCountdown } from "../../../utils/sessionSlotTimer";

export default function OneToOneMeetingViewer({ isHost, booking }) {
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
    stopRecording,
    meeting,
    recordingState,
    enableScreenShare,
    disableScreenShare,
  } = useMeeting({
    onError: (data) => {
      const { code, message } = data;
      Toast.show(`Error: ${code}: ${message}`);
    },
  });
  const recordingConsentPubSub = usePubSub("RECORDING_CONSENT", {});

  const leaveMenu = useRef();
  const bottomSheetRef = useRef();
  const audioDeviceMenuRef = useRef();
  const moreOptionsMenu = useRef();
  const recordingRef = useRef();
  const processedConsentMessagesRef = useRef(new Set());
  const localParticipantIdRef = useRef(null);
  const pendingRecordingRequestRef = useRef(null);
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

  const participantCount = participantIds ? participantIds.length : null;

  const [splitMode, setSplitMode] = useState(true);
  const [chatViewer, setchatViewer] = useState(false);
  const [participantListViewer, setparticipantListViewer] = useState(false);
  const [participantStatsViewer, setparticipantStatsViewer] = useState(false);

  const [audioDevice, setAudioDevice] = useState([]);
  const [statParticipantId, setstatParticipantId] = useState("");
  const [meetingElapsedSeconds, setMeetingElapsedSeconds] = useState(0);
  const slot = booking?.availability_slots || {};
  const [sessionTiming, setSessionTiming] = useState(() => computeSessionTiming(slot));

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
          // Try label/facingMode first; many Android devices use generic labels
          // so fall back to index-based assignment (cams[0]=front, cams[1]=back).
          const front = cams.find(c =>
            c.label?.toLowerCase().includes('front') ||
            c.label?.toLowerCase().includes('face') ||
            c.facingMode === 'user'
          ) ?? cams[0];

          const back = cams.find(c =>
            c.label?.toLowerCase().includes('back') ||
            c.label?.toLowerCase().includes('rear') ||
            c.facingMode === 'environment'
          ) ?? (cams.length > 1 ? cams.find(c => c.deviceId !== front?.deviceId) : null);

          frontCameraIdRef.current = front?.deviceId ?? null;
          backCameraIdRef.current = back?.deviceId ?? null;
          console.warn('[Camera] front:', front?.deviceId, front?.label, '| back:', back?.deviceId, back?.label);

          if (localWebcamOnRef.current && front?.deviceId && !cameraInitializedRef.current) {
            cameraInitializedRef.current = true;
            setTimeout(() => {
              if (!cancelled) changeWebcam(front.deviceId);
            }, 300);
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
    const delay = Platform.OS === 'ios' ? 1500 : 800;
    const t = setTimeout(() => fetchCameras(), delay);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  useEffect(() => {
    if (participantCount >= 2 && !bothJoinedAtRef.current) {
      bothJoinedAtRef.current = Date.now();
    }
  }, [participantCount]);

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
      setTimeout(() => changeWebcam(frontCameraIdRef.current), 400);
      return;
    }

    // IDs not loaded yet — enumerate now (fetchCameras hasn't finished).
    // Use ?.then() — getWebcams may be undefined on some SDK versions/platforms.
    getWebcams?.()
      ?.then(cams => {
        if (!cams?.length) return;
        const front =
          cams.find(c =>
            c.label?.toLowerCase().includes('front') ||
            c.label?.toLowerCase().includes('face') ||
            c.facingMode === 'user'
          ) || (cams.length > 1 ? cams[1] : null) || cams[0];
        const back = cams.find(c =>
          c.label?.toLowerCase().includes('back') ||
          c.label?.toLowerCase().includes('rear') ||
          c.facingMode === 'environment'
        ) || (cams.length > 1 ? cams.find(c => c.deviceId !== front?.deviceId) : null);
        frontCameraIdRef.current = front?.deviceId ?? null;
        backCameraIdRef.current = back?.deviceId ?? null;
        if (front?.deviceId) {
          cameraInitializedRef.current = true;
          setTimeout(() => changeWebcam(front.deviceId), 400);
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
    Alert.alert(
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
    if (participantCount < 2) {
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
    const messages = recordingConsentPubSub.messages || [];
    if (!messages.length) return;

    messages.forEach((entry) => {
      const uniqueMessageId = `${entry.timestamp}-${entry.senderId}-${entry.message}`;
      if (processedConsentMessagesRef.current.has(uniqueMessageId)) {
        return;
      }
      processedConsentMessagesRef.current.add(uniqueMessageId);

      if (entry.senderId === localParticipantIdRef.current) {
        return;
      }

      let payload;
      try {
        payload = JSON.parse(entry.message);
      } catch (e) {
        return;
      }

      if (!payload || typeof payload !== 'object' || typeof payload.type !== 'string') {
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
          if (isHost) {
            startOneToOneRecording(startRecording, Math.max(1, participantCount || 1));
          }
          Toast.show("Both agreed. Starting recording...");
        } else {
          Toast.show("Other participant declined recording.");
        }
        pendingRecordingRequestRef.current = null;
        return;
      }

      if (
        payload.type === "RECORDING_START_APPROVED" &&
        payload.requesterId !== localParticipantIdRef.current &&
        isHost
      ) {
        // Only start if truly stopped — not if already starting/started (avoids double-call)
        if (
          !recordingState ||
          recordingState === Constants.recordingEvents.RECORDING_STOPPED
        ) {
          startOneToOneRecording(startRecording, Math.max(1, participantCount || 1));
          Toast.show("Recording started.");
        }
        return;
      }
    });
  }, [recordingConsentPubSub.messages, isHost, recordingState, startRecording]);

  useEffect(() => {
    if (Platform.OS === "ios") {
      VideosdkRPK.addListener("onScreenShare", (event) => {
        if (event === "START_BROADCAST") {
          enableScreenShare();
        } else if (event === "STOP_BROADCAST") {
          disableScreenShare();
        }
      });

      return () => {
        VideosdkRPK.removeSubscription("onScreenShare");
      };
    }
  }, []);

  useEffect(() => {
    if (recordingRef.current) {
      if (
        recordingState === Constants.recordingEvents.RECORDING_STARTING ||
        recordingState === Constants.recordingEvents.RECORDING_STOPPING
      ) {
        recordingRef.current.start();
      } else {
        recordingRef.current.stop();
      }
    }
  }, [recordingState]);

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
    recordingState === Constants.recordingEvents.RECORDING_STARTED ||
    recordingState === Constants.recordingEvents.RECORDING_STOPPING ||
    recordingState === Constants.recordingEvents.RECORDING_STARTING;

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

  const MIN_SESSION_SECONDS = 300; // 5 minutes

  const tryLeave = (endForAll = false) => {
    if (bothJoinedAtRef.current) {
      const elapsed = Math.floor((Date.now() - bothJoinedAtRef.current) / 1000);
      if (elapsed < MIN_SESSION_SECONDS) {
        const remainingSec = MIN_SESSION_SECONDS - elapsed;
        const remainingMin = Math.ceil(remainingSec / 60);
        Toast.show(
          `Minimum 5 minutes required. ${remainingMin} min${remainingMin !== 1 ? 's' : ''} remaining.`
        );
        return;
      }
    }
    if (endForAll) {
      end();
    } else {
      leave();
    }
  };

  const confirmLeaveMeeting = () => {
    if (bothJoinedAtRef.current) {
      const elapsed = Math.floor((Date.now() - bothJoinedAtRef.current) / 1000);
      if (elapsed < MIN_SESSION_SECONDS) {
        const remainingSec = MIN_SESSION_SECONDS - elapsed;
        const remainingMin = Math.ceil(remainingSec / 60);
        Alert.alert(
          'Cannot leave yet',
          `Sessions must be at least 5 minutes long. Please wait ${remainingMin} more minute${remainingMin !== 1 ? 's' : ''}.`,
          [{ text: 'OK' }]
        );
        return;
      }
    }
    Alert.alert(
      "Leave meeting?",
      "Are you sure you want to leave this meeting?",
      [
        { text: "Stay in meeting", style: "cancel" },
        { text: "Leave meeting", style: "destructive", onPress: () => leave() },
      ],
      { cancelable: true }
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
  }, [leave]);

  // AppState — camera off in background, restore on foreground.
  // Auto-leave after 3 minutes in background so the meeting doesn't
  // silently run forever if the user switches apps and forgets.
  // Uses refs for webcam state so the subscription is stable and
  // never re-created mid-session (avoids stale-closure restore bug).
  useEffect(() => {
    const BG_LEAVE_MS = 3 * 60 * 1000; // 3 minutes
    const appStateRef = { current: AppState.currentState };
    const webcamWasOnRef = { current: false };
    let bgTimer = null;

    const clearBgTimer = () => {
      if (bgTimer) {
        clearTimeout(bgTimer);
        bgTimer = null;
      }
    };

    const subscription = AppState.addEventListener('change', nextState => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (prev === 'active' && nextState.match(/inactive|background/)) {
        webcamWasOnRef.current = localWebcamOnRef.current;
        if (localWebcamOnRef.current) toggleWebcam();

        bgTimer = setTimeout(() => {
          Toast.show('Session ended — app was in background too long');
          leave();
        }, BG_LEAVE_MS);
      }

      if (nextState === 'active' && prev.match(/inactive|background/)) {
        clearBgTimer();
        if (webcamWasOnRef.current) {
          setTimeout(() => {
            toggleWebcam();
            if (frontCameraIdRef.current) {
              setTimeout(() => changeWebcam(frontCameraIdRef.current), 400);
            }
          }, 300);
        }
      }
    });

    return () => {
      clearBgTimer();
      subscription.remove();
    };
  }, [toggleWebcam, changeWebcam, leave]);

  // Pre-define icon elements so they are stable across renders.
  // Passing `Icon={() => <X />}` creates a new component type each render,
  // which unmounts/remounts the child during a touch gesture and cancels it.
  const CallEndIcon = () => <CallEnd height={26} width={26} fill="#FFF" />;
  const MicIcon = () => localMicOn
    ? <MicOn height={24} width={24} fill="#FFF" />
    : <MicOff height={28} width={28} fill="#1D2939" />;
  const CamIcon = () => localWebcamOn
    ? <VideoOn height={24} width={24} fill="#FFF" />
    : <VideoOff height={36} width={36} fill="#1D2939" />;
  const ChatIcon = () => <Chat height={22} width={22} fill="#FFF" />;
  const MoreIcon = () => <More height={18} width={18} fill="#FFF" />;

  return (
    <View style={{ flex: 1 }}>
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
                      color: "rgba(255, 255, 255, 0.75)",
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
            onPress={() => setSplitMode(v => !v)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <View style={{ width: 26, height: 26, justifyContent: 'center', alignItems: 'center' }}>
              {splitMode ? (
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
      <View style={{ flex: 1, marginTop: 8, marginBottom: 12, overflow: 'hidden' }}>
        {participantCount > 1 ? (
          splitMode ? (
            localScreenShareOn ? (
              <LocalParticipantPresenter />
            ) : (
              <View style={{ flex: 1, gap: 8 }}>
                <View style={{ flex: 1 }}>
                  {remoteParticipantId ? (
                    <LargeView
                      participantId={remoteParticipantId}
                      openStatsBottomSheet={openStatsBottomSheet}
                    />
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  {localParticipantId ? (
                    <LargeView
                      participantId={localParticipantId}
                      openStatsBottomSheet={openStatsBottomSheet}
                    />
                  ) : null}
                </View>
              </View>
            )
          ) : (
            <>
              {localScreenShareOn ? (
                <LocalParticipantPresenter />
              ) : (
                <LargeView
                  participantId={remoteParticipantId ?? participantIds[1]}
                  openStatsBottomSheet={openStatsBottomSheet}
                />
              )}
              <MiniView
                openStatsBottomSheet={openStatsBottomSheet}
                participantId={
                  participantIds[localScreenShareOn || presenterId ? 1 : 0]
                }
              />
            </>
          )
        ) : participantCount === 1 ? (
          <LocalViewContainer participantId={participantIds[0]} />
        ) : (
          <View
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
            <CosmicLoader size={56} />
          </View>
        )}
      </View>
      <Menu
        ref={leaveMenu}
        menuBackgroundColor={colors.primary[700]}
        placement="left"
      >
        <MenuItem
          title={"Leave call"}
          onPress={() => {
            tryLeave(false);
            moreOptionsMenu.current.close();
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
            !recordingState ||
            recordingState === Constants.recordingEvents.RECORDING_STOPPED
              ? "Start"
              : recordingState === Constants.recordingEvents.RECORDING_STARTING
              ? "Starting"
              : recordingState === Constants.recordingEvents.RECORDING_STOPPING
              ? "Stopping"
              : "Stop"
          } Recording`}
          icon={<Recording width={22} height={22} />}
          onPress={() => {
            if (
              !recordingState ||
              recordingState === Constants.recordingEvents.RECORDING_STOPPED
            ) {
              requestRecordingConsent();
            } else if (
              recordingState === Constants.recordingEvents.RECORDING_STARTED
            ) {
              if (!isHost) {
                Toast.show("Only mentor can stop recording");
              } else {
                stopRecording();
              }
            }
            moreOptionsMenu.current.close();
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
              if (presenterId == null || localScreenShareOn)
                Platform.OS === "android"
                  ? toggleScreenShare()
                  : VideosdkRPK.startBroadcast();
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
          Icon={CallEndIcon}
          onPress={confirmLeaveMeeting}
        />
        <IconContainer
          style={{ paddingLeft: 0, height: 52 }}
          isDropDown={true}
          onDropDownPress={async () => {
            await updateAudioDeviceList();
            audioDeviceMenuRef.current.show();
          }}
          backgroundColor={!localMicOn ? colors.primary[100] : "transparent"}
          onPress={toggleMic}
          Icon={MicIcon}
        />
        <IconContainer
          style={{ borderWidth: 1.5, borderColor: "#2B3034" }}
          backgroundColor={!localWebcamOn ? colors.primary[100] : "transparent"}
          onPress={() => {
            if (!localWebcamOn) {
              toggleWebcam();
              setTimeout(() => {
                const id = frontCameraIdRef.current;
                if (id) changeWebcam(id);
                else changeWebcam();
              }, 400);
            } else {
              toggleWebcam();
            }
          }}
          Icon={CamIcon}
        />
        <IconContainer
          onPress={() => {
            setchatViewer(true);
            bottomSheetRef.current.show();
          }}
          style={{ borderWidth: 1.5, borderColor: "#2B3034" }}
          Icon={ChatIcon}
        />
        <IconContainer
          style={{
            borderWidth: 1.5,
            borderColor: "#2B3034",
            transform: [{ rotate: "90deg" }],
          }}
          onPress={() => moreOptionsMenu.current.show()}
          Icon={MoreIcon}
        />
      </View>
      <BottomSheet
        sheetBackgroundColor={"#2B3034"}
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
    </View>
  );
}
