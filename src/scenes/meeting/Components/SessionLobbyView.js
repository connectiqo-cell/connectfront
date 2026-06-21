import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CosmicButton from '../../../components/CosmicButton';
import CosmicBackground from '../../../components/CosmicBackground';
import { scheduleStyles } from '../../../components/schedule/ScheduleUI';
import { UNIFIED_THEME } from '../../../unifiedTheme';
import { formatTime, formatDateForDisplay } from '../../../utils/dateHelpers';
import {
  formatCountdown,
  computeSessionTiming,
  slotDurationMinutes,
} from '../../../utils/sessionSlotTimer';
import {
  getMainLobbyPanelType,
  getParticipantStatusText,
  resolveLobbyPartner,
  shouldTransitionToExpiredOnSlotEnd,
} from '../../../utils/sessionLobbyRules';

const ENTRANCE_STEP_MS = 50;

const T = UNIFIED_THEME;
const C = T.colors;
const B = C.buttons;
const S = C.surface;
const PURPLE_LINK = B.nebulaGradient[0];
const TEAL = C.accent.secondary;
const GOLD = C.accent.primary;
const ERROR = C.accent.error;
const SUCCESS = C.accent.success;
const GLASS_BG = S.chipStrong;
const GLASS_BORDER = C.border.light;
const PANEL = S.panel;

function FadeSlideIn({ delay = 0, children, style, fromY = 16 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(fromY)).current;
  const played = useRef(false);

  useEffect(() => {
    if (played.current) return undefined;
    played.current = true;
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 360,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 88,
        delay,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [delay, fromY, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

function PressScale({ onPress, children, style, disabled, hitSlop }) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, { toValue: 0.95, friction: 6, tension: 140, useNativeDriver: true }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled}
        hitSlop={hitSlop}
        style={({ pressed, hovered }) => [
          style,
          (pressed || hovered) && styles.interactiveHover,
          pressed && styles.interactivePressed,
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function PulseLoop({ children, style, color = TEAL, minOpacity = 0.35, maxOpacity = 1 }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [minOpacity, maxOpacity] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });

  return (
    <View style={style}>
      <Animated.View
        style={[
          styles.pulseHalo,
          { backgroundColor: color, opacity, transform: [{ scale }] },
        ]}
      />
      {children}
    </View>
  );
}

function AnimatedProgressFill({ progress, colors }) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(widthAnim, {
      toValue: Math.max(0, Math.min(1, progress)),
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, widthAnim]);

  const width = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={{ width, height: '100%' }}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.progressFill} />
    </Animated.View>
  );
}

function LobbyShell({ insets, children, scroll = false }) {
  const body = scroll ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <CosmicBackground style={styles.root}>
      {body}
    </CosmicBackground>
  );
}

function LobbyHeader({ title, subtitle, onBack }) {
  return (
    <FadeSlideIn delay={0} fromY={10}>
      <View style={styles.topBarWrap}>
        <View style={scheduleStyles.topBar}>
          <PressScale onPress={onBack} style={styles.backBtn} hitSlop={12}>
            <MaterialIcons name="arrow-back" size={22} color={C.text.primary} />
          </PressScale>
          <View style={scheduleStyles.topBarCenter}>
            <Text style={scheduleStyles.topBarTitle}>{title}</Text>
            {subtitle ? <Text style={scheduleStyles.topBarSub}>{subtitle}</Text> : null}
          </View>
          <View style={scheduleStyles.topBarSide} />
        </View>
      </View>
    </FadeSlideIn>
  );
}

function StatusBadge({ status }) {
  if (status === 'live') {
    return (
      <View style={[styles.statusBadge, styles.statusBadgeLive]}>
        <PulseLoop style={styles.liveDotWrap} color={SUCCESS} minOpacity={0.5} maxOpacity={1}>
          <View style={styles.liveDot} />
        </PulseLoop>
        <Text style={styles.statusBadgeLiveText}>LIVE</Text>
      </View>
    );
  }
  if (status === 'upcoming') {
    return (
      <View style={[styles.statusBadge, styles.statusBadgeUpcoming]}>
        <MaterialIcons name="schedule" size={12} color={GOLD} />
        <Text style={styles.statusBadgeUpcomingText}>UPCOMING</Text>
      </View>
    );
  }
  return (
    <View style={[styles.statusBadge, styles.statusBadgeEnded]}>
      <MaterialIcons name="timer-off" size={12} color={ERROR} />
      <Text style={styles.statusBadgeEndedText}>ENDED</Text>
    </View>
  );
}

function SessionStatusCard({ timing, durationMin, animDelay = 0 }) {
  const { status, remainingSec, untilStartSec, elapsedSec, totalSec } = timing;
  const progress = totalSec > 0 ? Math.min(1, elapsedSec / totalSec) : 0;

  const timerValue =
    status === 'upcoming'
      ? formatCountdown(untilStartSec)
      : status === 'live'
        ? formatCountdown(remainingSec)
        : '00:00';

  const timerLabel =
    status === 'upcoming'
      ? 'Starts in'
      : status === 'live'
        ? 'Time remaining'
        : 'Session closed';

  const timerHint =
    status === 'upcoming'
      ? `${durationMin} min session · opens soon`
      : status === 'live'
        ? `${formatCountdown(elapsedSec)} elapsed · ${durationMin} min total`
        : 'Your booking window has ended';

  return (
    <FadeSlideIn delay={animDelay} style={styles.animBlock}>
      <View
        style={[
          styles.statusCard,
          status === 'live' && styles.statusCardLive,
          status === 'upcoming' && styles.statusCardUpcoming,
          status === 'ended' && styles.statusCardEnded,
        ]}
      >
        <View style={styles.statusCardTop}>
          <StatusBadge status={status} />
          <View style={styles.durationTag}>
            <MaterialIcons name="timelapse" size={12} color={C.text.secondary} />
            <Text style={styles.durationTagText}>{durationMin} min</Text>
          </View>
        </View>
        <Text style={styles.statusCardLabel}>{timerLabel}</Text>
        <Text
          style={[
            styles.statusCardTimer,
            status === 'live' && styles.statusCardTimerLive,
            status === 'upcoming' && styles.statusCardTimerUpcoming,
            status === 'ended' && styles.statusCardTimerEnded,
          ]}
        >
          {timerValue}
        </Text>
        {status === 'live' ? (
          <View style={styles.progressTrack}>
            <AnimatedProgressFill progress={progress} colors={B.successGradient} />
          </View>
        ) : null}
        <Text style={styles.statusCardHint}>{timerHint}</Text>
      </View>
    </FadeSlideIn>
  );
}

function ParticipantCard({
  otherUser,
  otherName,
  otherLabel,
  connecting,
  isSessionLive,
  isSessionUpcoming,
  sessionTiming,
  slot,
  meetingReady = false,
  animDelay = 0,
}) {
  const statusText = meetingReady
    ? `${otherLabel.charAt(0).toUpperCase() + otherLabel.slice(1)} is ready! Tap Join Call below.`
    : getParticipantStatusText({
        connecting,
        isSessionUpcoming,
        isSessionLive,
        untilStartSec: sessionTiming.untilStartSec,
        remainingSec: sessionTiming.remainingSec,
        otherLabel,
        formatCountdown,
      });

  const statusColor = meetingReady ? SUCCESS : connecting ? GOLD : isSessionLive ? SUCCESS : TEAL;

  return (
    <FadeSlideIn delay={animDelay} style={styles.animBlock}>
      <View style={styles.participantCard}>
        <PulseLoop style={styles.avatarPulseWrap} color={TEAL} minOpacity={0.2} maxOpacity={0.55}>
          <View style={styles.avatarFrame}>
            {otherUser?.avatar_url ? (
              <Image source={{ uri: otherUser.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{otherName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>
        </PulseLoop>

        <Text style={styles.participantName}>{otherName}</Text>
        <Text style={styles.roleLabel}>
          {otherLabel.charAt(0).toUpperCase() + otherLabel.slice(1)}
        </Text>

        <View style={styles.connectionRow}>
          {connecting ? (
            <ActivityIndicator size="small" color={GOLD} style={styles.connectionSpinner} />
          ) : (
            <PulseLoop style={styles.connectionDotWrap} color={statusColor} minOpacity={0.45} maxOpacity={1}>
              <View style={[styles.connectionDot, { backgroundColor: statusColor }]} />
            </PulseLoop>
          )}
          <Text style={styles.connectionText}>{statusText}</Text>
        </View>

        <View style={styles.sessionDetails}>
          <View style={styles.sessionDetailItem}>
            <MaterialIcons name="event" size={15} color={TEAL} />
            <Text style={styles.sessionDetailText}>{formatDateForDisplay(slot.date)}</Text>
          </View>
          <View style={styles.sessionDetailDivider} />
          <View style={styles.sessionDetailItem}>
            <MaterialIcons name="access-time" size={15} color={TEAL} />
            <Text style={styles.sessionDetailText}>
              {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
            </Text>
          </View>
        </View>
      </View>
    </FadeSlideIn>
  );
}

function ActionsPanel({ title, children, animDelay = 0 }) {
  return (
    <FadeSlideIn delay={animDelay} style={styles.animBlock}>
      <View style={styles.actionsPanel}>
        <Text style={styles.actionsPanelTitle}>{title}</Text>
        <View style={styles.actionsPanelBody}>{children}</View>
      </View>
    </FadeSlideIn>
  );
}

function OptionRow({ icon, title, subtitle, onPress, accent, danger }) {
  return (
    <PressScale onPress={onPress} style={styles.optionRow}>
      <View
        style={[
          styles.optionIcon,
          accent && styles.optionIconAccent,
          danger && styles.optionIconDanger,
        ]}
      >
        <MaterialIcons
          name={icon}
          size={20}
          color={danger ? ERROR : accent ? TEAL : PURPLE_LINK}
        />
      </View>
      <View style={styles.optionText}>
        <Text style={[styles.optionTitle, danger && styles.optionTitleDanger]}>{title}</Text>
        {subtitle ? <Text style={styles.optionSub}>{subtitle}</Text> : null}
      </View>
      <MaterialIcons name="chevron-right" size={20} color={C.text.muted} />
    </PressScale>
  );
}

function LobbyControlBar({ micOn, camOn, onToggleMic, onToggleCam, onLeave, connecting, bottomInset, animDelay = 0 }) {
  const controls = [
    {
      key: 'mic',
      icon: micOn ? 'mic' : 'mic-off',
      label: 'Mic',
      onPress: onToggleMic,
      enabled: !!onToggleMic,
      active: micOn,
    },
    {
      key: 'cam',
      icon: camOn ? 'videocam' : 'videocam-off',
      label: 'Camera',
      onPress: onToggleCam,
      enabled: !!onToggleCam,
      active: camOn,
    },
    { key: 'chat', icon: 'chat-bubble-outline', label: 'Chat', enabled: false },
    { key: 'speaker', icon: 'volume-up', label: 'Speaker', enabled: true, active: true },
  ];

  return (
    <FadeSlideIn delay={animDelay} fromY={24} style={styles.controlDockWrap}>
      <View style={[styles.controlDock, { paddingBottom: Math.max(bottomInset, 12) }]}>
        <LinearGradient
          colors={C.tabBar.flatBarEdge}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.controlDockEdge}
          pointerEvents="none"
        />
        <View style={styles.controlDockInner}>
          {controls.map(ctrl => (
            <PressScale
              key={ctrl.key}
              onPress={ctrl.onPress}
              disabled={!ctrl.onPress}
              style={[styles.controlTile, !ctrl.enabled && styles.controlTileDisabled]}
            >
              <View
                style={[
                  styles.controlIconBox,
                  ctrl.active && styles.controlIconBoxActive,
                  !ctrl.enabled && styles.controlIconBoxDisabled,
                ]}
              >
                <MaterialIcons
                  name={ctrl.icon}
                  size={20}
                  color={!ctrl.enabled ? C.text.muted : ctrl.active ? TEAL : C.text.primary}
                />
              </View>
              <Text style={[styles.controlLabel, !ctrl.enabled && styles.controlLabelMuted]}>
                {ctrl.label}
              </Text>
            </PressScale>
          ))}
          <PressScale onPress={onLeave} style={styles.controlTile}>
            <View style={styles.controlLeaveBox}>
              <MaterialIcons name="call-end" size={20} color={B.dangerSolidText} />
            </View>
            <Text style={[styles.controlLabel, styles.controlLabelLeave]}>Leave</Text>
          </PressScale>
        </View>
        {connecting ? (
          <Text style={styles.controlDockHint}>Setting up your audio & video…</Text>
        ) : null}
      </View>
    </FadeSlideIn>
  );
}

function CenteredState({ icon, iconColor, iconBg, title, subtitle, children, animDelay = 0 }) {
  return (
    <FadeSlideIn delay={animDelay} style={styles.centeredState}>
      <PulseLoop style={styles.stateIconPulseWrap} color={iconColor} minOpacity={0.15} maxOpacity={0.4}>
        <View style={[styles.stateIconBox, iconBg && { backgroundColor: iconBg }]}>
          <MaterialIcons name={icon} size={48} color={iconColor} />
        </View>
      </PulseLoop>
      <Text style={styles.stateTitle}>{title}</Text>
      {subtitle ? <Text style={styles.stateSub}>{subtitle}</Text> : null}
      {children}
    </FadeSlideIn>
  );
}

export default function SessionLobbyView({
  booking,
  isMentor,
  otherUser,
  connecting = false,
  micOn = false,
  camOn = false,
  onToggleMic,
  onToggleCam,
  onLeave,
  onReschedule,
  onCancelRefund,
  meetingReady = false,
  onJoinCall,
}) {
  const insets = useSafeAreaInsets();
  const slot = booking?.availability_slots || {};
  const durationMin = slotDurationMinutes(slot.start_time, slot.end_time);
  const partner = resolveLobbyPartner({ booking, isMentor, otherUser });
  const otherName = partner.name;
  const otherLabel = isMentor ? 'learner' : 'mentor';

  const [phase, setPhase] = useState('main');
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [sessionTiming, setSessionTiming] = useState(() => computeSessionTiming(slot));
  const slotExpiredRef = useRef(false);

  const handleRescheduleRequest = useCallback(async () => {
    setRescheduleLoading(true);
    try {
      await onReschedule?.();
    } finally {
      setRescheduleLoading(false);
    }
  }, [onReschedule]);

  const updateSessionTimer = useCallback(() => {
    const timing = computeSessionTiming(slot);
    setSessionTiming(timing);
    if (shouldTransitionToExpiredOnSlotEnd(timing.status, slotExpiredRef.current)) {
      slotExpiredRef.current = true;
      setPhase('expired');
    }
  }, [slot.date, slot.start_time, slot.end_time]);

  useEffect(() => {
    updateSessionTimer();
    const id = setInterval(updateSessionTimer, 1000);
    return () => clearInterval(id);
  }, [updateSessionTimer]);

  const isSessionLive = sessionTiming.status === 'live';
  const isSessionUpcoming = sessionTiming.status === 'upcoming';
  const mainPanelType = getMainLobbyPanelType(sessionTiming.status);

  const controlBar = (
    <LobbyControlBar
      micOn={micOn}
      camOn={camOn}
      onToggleMic={onToggleMic}
      onToggleCam={onToggleCam}
      onLeave={onLeave}
      connecting={connecting}
      bottomInset={insets.bottom}
      animDelay={ENTRANCE_STEP_MS * 4}
    />
  );

  if (phase === 'reschedule') {
    return (
      <LobbyShell insets={insets} scroll>
        <LobbyHeader title="Reschedule" subtitle={`With ${otherName}`} onBack={() => setPhase('main')} />
        <View style={styles.rescheduleCard}>
          <View style={styles.rescheduleIconWrap}>
            <MaterialIcons name="event-repeat" size={32} color={TEAL} />
          </View>
          <Text style={styles.rescheduleCardTitle}>Free reschedule</Text>
          <Text style={styles.rescheduleCardSub}>
            Your session on {formatDateForDisplay(slot.date)} at {formatTime(slot.start_time)} will be
            rescheduled at no extra cost.
          </Text>
        </View>
        <View style={styles.rescheduleSlotPreview}>
          <MaterialIcons name="notifications-active" size={18} color={GOLD} />
          <Text style={styles.rescheduleSlotText}>
            {otherName} will be notified to propose a new time within 48 hours. You can then accept or suggest another.
          </Text>
        </View>
        <CosmicButton
          label={rescheduleLoading ? 'Sending request…' : 'Send Reschedule Request'}
          variant="success"
          onPress={handleRescheduleRequest}
          disabled={rescheduleLoading}
          style={styles.fullWidthCta}
        />
        <CosmicButton label="Back to waiting room" variant="ghost" onPress={() => setPhase('main')} />
      </LobbyShell>
    );
  }

  if (phase === 'refund_success') {
    return (
      <LobbyShell insets={insets}>
        <LobbyHeader title="Refund" onBack={onLeave} />
        <CenteredState
          icon="check-circle"
          iconColor={C.accent.success}
          iconBg={S.accentSuccess}
          title="Refund Initiated"
          subtitle="Your refund is being processed to your Connectiqo wallet. It may take 3–5 business days to reflect."
        >
          <CosmicButton label="Go to Home" variant="success" onPress={onLeave} style={styles.fullWidthCta} />
        </CenteredState>
      </LobbyShell>
    );
  }

  if (phase === 'expired') {
    return (
      <LobbyShell insets={insets} scroll>
        <LobbyHeader title="Session Expired" onBack={onLeave} />
        <CenteredState
          icon="error-outline"
          iconColor={ERROR}
          iconBg={B.dangerBg}
          title="Time Expired"
          subtitle={
            isMentor
              ? 'The session window has closed.'
              : `${otherName} didn't join within the session window. You can request a free reschedule.`
          }
        />
        {!isMentor ? (
          <ActionsPanel title="Your options">
            <OptionRow
              icon="event-repeat"
              title="Request Reschedule"
              subtitle="Mentor will propose a new time (free)"
              onPress={() => setPhase('reschedule')}
              accent
            />
          </ActionsPanel>
        ) : null}
        <CosmicButton label="Go to Home" variant="primary" onPress={onLeave} style={styles.fullWidthCta} />
        <View style={{ height: T.spacing.lg }} />
      </LobbyShell>
    );
  }

  const sessionProgress = sessionTiming.totalSec > 0
    ? Math.min(1, sessionTiming.elapsedSec / sessionTiming.totalSec)
    : 0;

  // ── Mentor lobby: already in meeting, waiting for learner ─────────────────
  if (isMentor) {
    return (
      <CosmicBackground style={styles.root}>
        {/* Header */}
        <FadeSlideIn delay={0} fromY={-10}>
          <View style={[styles.newHeader, { paddingTop: T.spacing.sm }]}>
            <PressScale onPress={onLeave} style={styles.backBtn} hitSlop={12}>
              <MaterialIcons name="arrow-back" size={22} color={C.text.primary} />
            </PressScale>
            <View style={styles.newHeaderCenter}>
              <Text style={styles.newHeaderTitle}>Session Room</Text>
              <Text style={styles.newHeaderSub}>1-on-1 Session</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
        </FadeSlideIn>

        {/* Hero */}
        <View style={styles.heroArea}>

          {/* Learner avatar + status */}
          <FadeSlideIn delay={ENTRANCE_STEP_MS} style={styles.avatarSection}>
            <PulseLoop style={styles.heroPulseWrap} color={TEAL} minOpacity={0.15} maxOpacity={0.45}>
              <View style={styles.heroAvatarFrame}>
                {partner?.avatar_url ? (
                  <Image source={{ uri: partner.avatar_url }} style={styles.heroAvatar} />
                ) : (
                  <View style={styles.heroAvatarFallback}>
                    <Text style={styles.heroAvatarInitial}>{otherName.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
              </View>
            </PulseLoop>
            <Text style={styles.heroName}>{otherName}</Text>
            <Text style={styles.heroRole}>LEARNER</Text>

            <View style={styles.statusChip}>
              <ActivityIndicator size="small" color={TEAL} style={{ marginRight: 2 }} />
              <Text style={styles.statusChipText}>Waiting for learner to join…</Text>
            </View>
          </FadeSlideIn>

          {/* Countdown */}
          <FadeSlideIn delay={ENTRANCE_STEP_MS * 2} style={styles.countdownSection}>
            <View style={[
              styles.countdownBox,
              sessionTiming.status === 'live' && styles.countdownBoxLive,
              sessionTiming.status === 'upcoming' && styles.countdownBoxUpcoming,
            ]}>
              <View style={styles.countdownTop}>
                <StatusBadge status={sessionTiming.status} />
                <View style={styles.durationTag}>
                  <MaterialIcons name="timelapse" size={12} color={C.text.secondary} />
                  <Text style={styles.durationTagText}>{durationMin} min</Text>
                </View>
              </View>
              <Text style={[
                styles.countdownTimer,
                sessionTiming.status === 'live' && { color: TEAL },
                sessionTiming.status === 'upcoming' && { color: GOLD },
                sessionTiming.status === 'ended' && { color: ERROR },
              ]}>
                {sessionTiming.status === 'upcoming'
                  ? formatCountdown(sessionTiming.untilStartSec)
                  : sessionTiming.status === 'live'
                    ? formatCountdown(sessionTiming.remainingSec)
                    : '00:00'}
              </Text>
              <Text style={styles.countdownLabel}>
                {sessionTiming.status === 'upcoming' ? 'until session starts' : sessionTiming.status === 'live' ? 'time remaining' : 'session ended'}
              </Text>
              {sessionTiming.status === 'live' ? (
                <View style={styles.progressTrack}>
                  <AnimatedProgressFill progress={sessionProgress} colors={B.successGradient} />
                </View>
              ) : null}
            </View>
          </FadeSlideIn>

          {/* Info strip */}
          <FadeSlideIn delay={ENTRANCE_STEP_MS * 3} style={styles.infoStripSection}>
            <View style={styles.infoStrip}>
              <View style={styles.infoStripItem}>
                <MaterialIcons name="event" size={14} color={TEAL} />
                <Text style={styles.infoStripText}>{formatDateForDisplay(slot.date)}</Text>
              </View>
              <View style={styles.infoStripDivider} />
              <View style={styles.infoStripItem}>
                <MaterialIcons name="access-time" size={14} color={TEAL} />
                <Text style={styles.infoStripText}>
                  {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                </Text>
              </View>
            </View>
          </FadeSlideIn>
        </View>

        {/* Mic / Camera controls + End Session */}
        <FadeSlideIn delay={ENTRANCE_STEP_MS * 4} fromY={24}>
          <View style={[styles.mentorControlBar, { paddingBottom: T.spacing.md }]}>
            {/* Mic */}
            <PressScale
              onPress={onToggleMic}
              disabled={!onToggleMic}
              style={[styles.mentorCtrlTile, !onToggleMic && styles.mentorCtrlTileDisabled]}
            >
              <View style={[styles.mentorCtrlIcon, micOn && styles.mentorCtrlIconActive]}>
                <MaterialIcons name={micOn ? 'mic' : 'mic-off'} size={22} color={micOn ? TEAL : C.text.muted} />
              </View>
              <Text style={styles.mentorCtrlLabel}>Mic</Text>
            </PressScale>

            {/* Camera */}
            <PressScale
              onPress={onToggleCam}
              disabled={!onToggleCam}
              style={[styles.mentorCtrlTile, !onToggleCam && styles.mentorCtrlTileDisabled]}
            >
              <View style={[styles.mentorCtrlIcon, camOn && styles.mentorCtrlIconActive]}>
                <MaterialIcons name={camOn ? 'videocam' : 'videocam-off'} size={22} color={camOn ? TEAL : C.text.muted} />
              </View>
              <Text style={styles.mentorCtrlLabel}>Camera</Text>
            </PressScale>

            {/* End Session */}
            <PressScale onPress={onLeave} style={styles.mentorCtrlTile}>
              <View style={styles.mentorCtrlIconEnd}>
                <MaterialIcons name="call-end" size={22} color="#fff" />
              </View>
              <Text style={[styles.mentorCtrlLabel, { color: ERROR }]}>End</Text>
            </PressScale>
          </View>
        </FadeSlideIn>
      </CosmicBackground>
    );
  }

  // ── Learner lobby ─────────────────────────────────────────────────────────
  return (
    <CosmicBackground style={styles.root}>
      {/* ── Header ─────────────────────────────────────── */}
      <FadeSlideIn delay={0} fromY={-10}>
        <View style={[styles.newHeader, { paddingTop: T.spacing.sm }]}>
          <PressScale onPress={onLeave} style={styles.backBtn} hitSlop={12}>
            <MaterialIcons name="arrow-back" size={22} color={C.text.primary} />
          </PressScale>
          <View style={styles.newHeaderCenter}>
            <Text style={styles.newHeaderTitle}>Waiting Room</Text>
            <Text style={styles.newHeaderSub}>1-on-1 Session</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </FadeSlideIn>

      {/* ── Hero ───────────────────────────────────────── */}
      <View style={styles.heroArea}>

        {/* Avatar + name + status */}
        <FadeSlideIn delay={ENTRANCE_STEP_MS} style={styles.avatarSection}>
          <PulseLoop
            style={styles.heroPulseWrap}
            color={meetingReady ? SUCCESS : TEAL}
            minOpacity={0.15}
            maxOpacity={0.45}
          >
            <View style={styles.heroAvatarFrame}>
              {partner?.avatar_url ? (
                <Image source={{ uri: partner.avatar_url }} style={styles.heroAvatar} />
              ) : (
                <View style={styles.heroAvatarFallback}>
                  <Text style={styles.heroAvatarInitial}>{otherName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </View>
          </PulseLoop>
          <Text style={styles.heroName}>{otherName}</Text>
          <Text style={styles.heroRole}>{otherLabel.toUpperCase()}</Text>

          <View style={[styles.statusChip, meetingReady && styles.statusChipReady]}>
            {meetingReady ? (
              <PulseLoop style={styles.chipDotWrap} color={SUCCESS} minOpacity={0.5} maxOpacity={1}>
                <View style={styles.chipDot} />
              </PulseLoop>
            ) : (
              <ActivityIndicator size="small" color={TEAL} style={{ marginRight: 2 }} />
            )}
            <Text style={[styles.statusChipText, meetingReady && styles.statusChipTextReady]}>
              {meetingReady ? 'Ready to join' : 'Waiting for mentor…'}
            </Text>
          </View>
        </FadeSlideIn>

        {/* Countdown card */}
        <FadeSlideIn delay={ENTRANCE_STEP_MS * 2} style={styles.countdownSection}>
          <View style={[
            styles.countdownBox,
            sessionTiming.status === 'live' && styles.countdownBoxLive,
            sessionTiming.status === 'upcoming' && styles.countdownBoxUpcoming,
          ]}>
            <View style={styles.countdownTop}>
              <StatusBadge status={sessionTiming.status} />
              <View style={styles.durationTag}>
                <MaterialIcons name="timelapse" size={12} color={C.text.secondary} />
                <Text style={styles.durationTagText}>{durationMin} min</Text>
              </View>
            </View>
            <Text style={[
              styles.countdownTimer,
              sessionTiming.status === 'live' && { color: TEAL },
              sessionTiming.status === 'upcoming' && { color: GOLD },
              sessionTiming.status === 'ended' && { color: ERROR },
            ]}>
              {sessionTiming.status === 'upcoming'
                ? formatCountdown(sessionTiming.untilStartSec)
                : sessionTiming.status === 'live'
                  ? formatCountdown(sessionTiming.remainingSec)
                  : '00:00'}
            </Text>
            <Text style={styles.countdownLabel}>
              {sessionTiming.status === 'upcoming'
                ? 'until session starts'
                : sessionTiming.status === 'live'
                  ? 'time remaining'
                  : 'session window closed'}
            </Text>
            {sessionTiming.status === 'live' ? (
              <View style={styles.progressTrack}>
                <AnimatedProgressFill progress={sessionProgress} colors={B.successGradient} />
              </View>
            ) : null}
          </View>
        </FadeSlideIn>

        {/* Session info strip */}
        <FadeSlideIn delay={ENTRANCE_STEP_MS * 3} style={styles.infoStripSection}>
          <View style={styles.infoStrip}>
            <View style={styles.infoStripItem}>
              <MaterialIcons name="event" size={14} color={TEAL} />
              <Text style={styles.infoStripText}>{formatDateForDisplay(slot.date)}</Text>
            </View>
            <View style={styles.infoStripDivider} />
            <View style={styles.infoStripItem}>
              <MaterialIcons name="access-time" size={14} color={TEAL} />
              <Text style={styles.infoStripText}>
                {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
              </Text>
            </View>
          </View>
        </FadeSlideIn>
      </View>

      {/* ── Bottom CTA ─────────────────────────────────── */}
      <FadeSlideIn delay={ENTRANCE_STEP_MS * 4} fromY={24}>
        <View style={[styles.bottomCta, { paddingBottom: T.spacing.md }]}>
          <PressScale onPress={onJoinCall} style={styles.joinCallBtn}>
            <View style={styles.joinCallStack}>
              <LinearGradient
                colors={meetingReady ? B.successGradient : ['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.04)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
              <View style={styles.joinCallGradient}>
                <MaterialIcons name="video-call" size={24} color={meetingReady ? '#000' : C.text.muted} />
                <Text style={[styles.joinCallText, !meetingReady && styles.joinCallTextMuted]}>
                  Join Call
                </Text>
                {meetingReady ? (
                  <PulseLoop style={styles.joinBtnDotWrap} color={SUCCESS} minOpacity={0.5} maxOpacity={1}>
                    <View style={styles.joinBtnDot} />
                  </PulseLoop>
                ) : (
                  <ActivityIndicator size="small" color={C.text.muted} />
                )}
              </View>
            </View>
          </PressScale>
          <PressScale onPress={onLeave} style={styles.leaveLink}>
            <Text style={styles.leaveLinkText}>Leave quietly</Text>
          </PressScale>
        </View>
      </FadeSlideIn>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: T.spacing.md,
    paddingBottom: T.spacing.xl,
    gap: T.spacing.md,
  },
  mainScrollContent: {
    paddingHorizontal: T.spacing.md,
    paddingBottom: T.spacing.sm,
    gap: T.spacing.md,
  },
  pressed: { opacity: 0.82 },
  interactiveHover: {
    backgroundColor: 'rgba(167,139,250,0.08)',
  },
  interactivePressed: {
    backgroundColor: 'rgba(167,139,250,0.14)',
  },
  animBlock: {
    width: '100%',
  },
  pulseHalo: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: T.borderRadius.sm,
  },
  liveDotWrap: {
    width: 8,
    height: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPulseWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: T.spacing.md,
  },
  connectionDotWrap: {
    width: 10,
    height: 10,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlDockWrap: {
    width: '100%',
  },
  stateIconPulseWrap: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: T.spacing.lg,
  },

  topBarWrap: {
    paddingHorizontal: T.spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: T.borderRadius.md,
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusCard: {
    borderRadius: T.borderRadius.lg,
    padding: T.spacing.lg,
    borderWidth: 1,
    backgroundColor: GLASS_BG,
    borderColor: GLASS_BORDER,
    ...Platform.select({ ios: T.shadows.small, android: { elevation: 3 } }),
  },
  statusCardUpcoming: {
    backgroundColor: S.accentGold,
    borderColor: B.goldOutlineBorder,
  },
  statusCardLive: {
    backgroundColor: S.accentSuccess,
    borderColor: B.successBorder,
  },
  statusCardEnded: {
    backgroundColor: B.dangerBg,
    borderColor: B.dangerBorder,
  },
  statusCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: T.spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: T.borderRadius.sm,
    borderWidth: 1,
  },
  statusBadgeLive: {
    backgroundColor: S.accentSuccess,
    borderColor: B.successBorder,
  },
  statusBadgeUpcoming: {
    backgroundColor: S.accentGold,
    borderColor: B.goldOutlineBorder,
  },
  statusBadgeEnded: {
    backgroundColor: B.dangerBg,
    borderColor: B.dangerBorder,
  },
  statusBadgeLiveText: {
    ...T.typography.bodyXs,
    fontWeight: '900',
    color: SUCCESS,
    letterSpacing: 0.8,
  },
  statusBadgeUpcomingText: {
    ...T.typography.bodyXs,
    fontWeight: '900',
    color: GOLD,
    letterSpacing: 0.8,
  },
  statusBadgeEndedText: {
    ...T.typography.bodyXs,
    fontWeight: '900',
    color: ERROR,
    letterSpacing: 0.8,
  },
  liveDot: {
    width: 6,
    height: 6,
    backgroundColor: SUCCESS,
  },
  durationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: T.borderRadius.sm,
    backgroundColor: S.chip,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  durationTagText: {
    ...T.typography.labelSm,
    color: C.text.secondary,
  },
  statusCardLabel: {
    ...T.typography.labelMd,
    color: PURPLE_LINK,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statusCardTimer: {
    fontSize: 42,
    fontWeight: '800',
    color: C.text.primary,
    letterSpacing: 2,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  statusCardTimerLive: { color: TEAL },
  statusCardTimerUpcoming: { color: GOLD },
  statusCardTimerEnded: { color: ERROR },
  statusCardHint: {
    ...T.typography.bodySm,
    fontWeight: '600',
    color: C.text.muted,
    marginTop: T.spacing.sm,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: S.chip,
    marginTop: T.spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },

  participantCard: {
    alignItems: 'center',
    padding: T.spacing.xl,
    borderRadius: T.borderRadius.lg,
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    ...Platform.select({ ios: T.shadows.medium, android: { elevation: 5 } }),
  },
  avatarFrame: {
    width: 96,
    height: 96,
    borderRadius: T.borderRadius.md,
    borderWidth: 2,
    borderColor: C.border.default,
    overflow: 'hidden',
    backgroundColor: C.primary.void,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    backgroundColor: S.accentViolet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: '800',
    color: PURPLE_LINK,
  },
  participantName: {
    ...T.typography.headingSm,
    color: C.text.primary,
    letterSpacing: -0.3,
  },
  roleLabel: {
    ...T.typography.labelSm,
    color: PURPLE_LINK,
    marginTop: 4,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: T.spacing.md,
    paddingHorizontal: T.spacing.md,
    paddingVertical: T.spacing.sm,
    borderRadius: T.borderRadius.sm,
    backgroundColor: S.chip,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    maxWidth: '100%',
    width: '100%',
  },
  connectionSpinner: { marginRight: 8 },
  connectionDot: {
    width: 8,
    height: 8,
    backgroundColor: TEAL,
  },
  connectionText: {
    flex: 1,
    ...T.typography.bodyMd,
    fontWeight: '600',
    color: C.text.secondary,
    textAlign: 'center',
  },
  sessionDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: T.spacing.lg,
    paddingTop: T.spacing.md,
    borderTopWidth: 1,
    borderTopColor: GLASS_BORDER,
    width: '100%',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: T.spacing.sm,
  },
  sessionDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sessionDetailDivider: {
    width: 1,
    height: 14,
    backgroundColor: GLASS_BORDER,
  },
  sessionDetailText: {
    ...T.typography.bodySm,
    fontWeight: '600',
    color: C.text.secondary,
  },

  actionsPanel: {
    gap: T.spacing.sm,
  },
  actionsPanelTitle: {
    ...T.typography.labelMd,
    color: PURPLE_LINK,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 2,
  },
  actionsPanelBody: {
    borderRadius: T.borderRadius.lg,
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    overflow: 'hidden',
  },
  preStartNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: T.spacing.sm,
    padding: T.spacing.md,
    backgroundColor: S.accentGold,
    borderBottomWidth: 1,
    borderBottomColor: B.goldOutlineBorder,
  },
  preStartNoteText: {
    flex: 1,
    ...T.typography.bodySm,
    fontWeight: '600',
    color: C.text.secondary,
    lineHeight: 18,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.md,
    padding: T.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
    width: '100%',
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: T.borderRadius.sm,
    backgroundColor: S.accentViolet,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: B.secondaryBorder,
  },
  optionIconAccent: { backgroundColor: S.accentTeal, borderColor: C.border.default },
  optionIconDanger: { backgroundColor: B.dangerBg, borderColor: B.dangerBorder },
  optionText: { flex: 1 },
  optionTitle: {
    ...T.typography.labelLg,
    fontWeight: '800',
    color: C.text.primary,
  },
  optionTitleDanger: { color: B.dangerText },
  optionSub: {
    ...T.typography.bodyXs,
    color: C.text.muted,
    marginTop: 2,
    lineHeight: 16,
  },

  controlDock: {
    borderTopWidth: 1,
    borderTopColor: C.tabBar.glassBorder,
    backgroundColor: C.tabBar.flatBarBase,
    paddingTop: T.spacing.md,
    paddingHorizontal: T.spacing.sm,
  },
  controlDockEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  controlDockInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: T.spacing.xs,
  },
  controlDockHint: {
    fontSize: 11,
    fontWeight: '600',
    color: C.text.muted,
    textAlign: 'center',
    marginTop: T.spacing.sm,
  },
  controlTile: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  controlTileDisabled: { opacity: 0.55 },
  controlIconBox: {
    width: 44,
    height: 44,
    borderRadius: T.borderRadius.sm,
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlIconBoxActive: {
    backgroundColor: S.accentTeal,
    borderColor: C.border.default,
  },
  controlIconBoxDisabled: {
    backgroundColor: C.component.disabled,
  },
  controlLeaveBox: {
    width: 44,
    height: 44,
    borderRadius: T.borderRadius.sm,
    backgroundColor: B.dangerSolid,
    borderWidth: 1,
    borderColor: B.dangerBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlLabel: {
    ...T.typography.bodyXs,
    fontWeight: '600',
    color: C.text.primary,
  },
  controlLabelMuted: { color: C.text.muted },
  controlLabelLeave: { color: ERROR, fontWeight: '700' },

  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: T.spacing.xl,
    paddingVertical: T.spacing.xxl,
  },
  stateIconBox: {
    width: 80,
    height: 80,
    borderRadius: T.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  stateTitle: {
    ...T.typography.headingSm,
    color: C.text.primary,
    textAlign: 'center',
  },
  stateSub: {
    ...T.typography.bodyMd,
    color: C.text.muted,
    textAlign: 'center',
    marginTop: T.spacing.sm,
    lineHeight: 22,
    maxWidth: 300,
  },
  fullWidthCta: {
    width: '100%',
    marginTop: T.spacing.md,
  },

  rescheduleCard: {
    alignItems: 'center',
    padding: T.spacing.xl,
    borderRadius: T.borderRadius.lg,
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    gap: T.spacing.sm,
  },
  rescheduleIconWrap: {
    width: 64,
    height: 64,
    borderRadius: T.borderRadius.md,
    backgroundColor: S.accentTeal,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: T.spacing.sm,
    borderWidth: 1,
    borderColor: C.border.default,
  },
  rescheduleCardTitle: {
    ...T.typography.headingXs,
    fontWeight: '800',
    color: C.text.primary,
  },
  rescheduleCardSub: {
    ...T.typography.bodyMd,
    color: C.text.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  rescheduleSlotPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: T.spacing.md,
    borderRadius: T.borderRadius.sm,
    backgroundColor: S.accentGold,
    borderWidth: 1,
    borderColor: B.goldOutlineBorder,
  },
  rescheduleSlotText: {
    flex: 1,
    ...T.typography.bodySm,
    fontWeight: '600',
    color: GOLD,
    lineHeight: 18,
  },

  /* ── New main lobby styles ──────────────────────────── */
  newHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: T.spacing.md,
    paddingBottom: T.spacing.sm,
  },
  newHeaderCenter: { flex: 1, alignItems: 'center' },
  newHeaderTitle: {
    ...T.typography.headingXs,
    color: C.text.primary,
    fontWeight: '800',
  },
  newHeaderSub: {
    ...T.typography.bodyXs,
    color: C.text.muted,
    marginTop: 2,
  },

  heroArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: T.spacing.lg,
    gap: T.spacing.lg,
  },

  avatarSection: {
    alignItems: 'center',
    gap: T.spacing.xs,
  },
  heroPulseWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: T.spacing.sm,
  },
  heroAvatarFrame: {
    width: 110,
    height: 110,
    borderRadius: T.borderRadius.lg,
    borderWidth: 2,
    borderColor: C.border.default,
    overflow: 'hidden',
    backgroundColor: C.primary.void,
  },
  heroAvatar: { width: '100%', height: '100%' },
  heroAvatarFallback: {
    flex: 1,
    backgroundColor: S.accentViolet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarInitial: {
    fontSize: 44,
    fontWeight: '800',
    color: PURPLE_LINK,
  },
  heroName: {
    ...T.typography.headingSm,
    color: C.text.primary,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: T.spacing.xs,
  },
  heroRole: {
    ...T.typography.labelSm,
    color: PURPLE_LINK,
    letterSpacing: 1.2,
    marginTop: 2,
  },

  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: T.spacing.sm,
    paddingHorizontal: T.spacing.md,
    paddingVertical: 8,
    borderRadius: T.borderRadius.full ?? 999,
    backgroundColor: S.chip,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  statusChipReady: {
    backgroundColor: S.accentSuccess,
    borderColor: B.successBorder,
  },
  chipDotWrap: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: SUCCESS,
  },
  statusChipText: {
    ...T.typography.bodySm,
    fontWeight: '700',
    color: C.text.muted,
  },
  statusChipTextReady: {
    color: SUCCESS,
  },

  countdownSection: {
    width: '100%',
  },
  countdownBox: {
    borderRadius: T.borderRadius.lg,
    padding: T.spacing.lg,
    borderWidth: 1,
    backgroundColor: GLASS_BG,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    gap: 4,
  },
  countdownBoxLive: {
    backgroundColor: S.accentSuccess,
    borderColor: B.successBorder,
  },
  countdownBoxUpcoming: {
    backgroundColor: S.accentGold,
    borderColor: B.goldOutlineBorder,
  },
  countdownTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: T.spacing.xs,
  },
  countdownTimer: {
    fontSize: 44,
    fontWeight: '800',
    color: C.text.primary,
    letterSpacing: 3,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  countdownLabel: {
    ...T.typography.bodySm,
    fontWeight: '600',
    color: C.text.muted,
    marginTop: 2,
  },

  infoStripSection: {
    width: '100%',
  },
  infoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PANEL,
    borderRadius: T.borderRadius.md,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingVertical: T.spacing.md,
    paddingHorizontal: T.spacing.lg,
    gap: T.spacing.md,
  },
  infoStripItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    justifyContent: 'center',
  },
  infoStripDivider: {
    width: 1,
    height: 18,
    backgroundColor: GLASS_BORDER,
  },
  infoStripText: {
    ...T.typography.bodySm,
    fontWeight: '700',
    color: C.text.secondary,
  },

  bottomCta: {
    paddingHorizontal: T.spacing.lg,
    paddingTop: T.spacing.md,
    gap: T.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: GLASS_BORDER,
    backgroundColor: 'rgba(10,10,26,0.6)',
  },

  joinCallBtn: {
    width: '100%',
    borderRadius: T.borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  joinCallStack: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: T.borderRadius.lg,
  },
  joinCallGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.spacing.sm,
    paddingVertical: 18,
    zIndex: 1,
    ...(Platform.OS === 'ios'
      ? { width: '100%', alignSelf: 'stretch', backgroundColor: 'transparent' }
      : {}),
  },
  joinCallText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.4,
    flex: 0,
  },
  joinCallTextMuted: {
    color: C.text.muted,
  },
  joinBtnDotWrap: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtnDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#000',
  },

  leaveLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: T.spacing.sm,
  },
  leaveLinkText: {
    ...T.typography.bodySm,
    color: C.text.muted,
    fontWeight: '600',
  },

  /* ── Mentor control bar ─────────────────────────────── */
  mentorControlBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: T.spacing.xl,
    paddingHorizontal: T.spacing.xl,
    paddingTop: T.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: GLASS_BORDER,
    backgroundColor: 'rgba(10,10,26,0.6)',
  },
  mentorCtrlTile: {
    alignItems: 'center',
    gap: 6,
    minWidth: 64,
  },
  mentorCtrlTileDisabled: { opacity: 0.45 },
  mentorCtrlIcon: {
    width: 56,
    height: 56,
    borderRadius: T.borderRadius.md,
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentorCtrlIconActive: {
    backgroundColor: S.accentTeal,
    borderColor: C.border.default,
  },
  mentorCtrlIconEnd: {
    width: 56,
    height: 56,
    borderRadius: T.borderRadius.md,
    backgroundColor: B.dangerSolid,
    borderWidth: 1,
    borderColor: B.dangerBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentorCtrlLabel: {
    ...T.typography.bodyXs,
    fontWeight: '700',
    color: C.text.secondary,
  },
});
