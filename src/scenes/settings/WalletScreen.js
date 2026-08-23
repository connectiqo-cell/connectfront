import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  RefreshControl,
  Pressable,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import Toast from 'react-native-simple-toast';
import { useFocusEffect } from '@react-navigation/native';
import moment from 'moment';
import { SafeScreen } from '../../components/SafeScreen';
import StackScreenHeader from '../../components/StackScreenHeader';
import { STACK_OVERLAY_LAYOUT } from '../../utils/platformLayout';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { useThemedStyles, useTheme } from '../../hooks/useTheme';
import { softFill } from '../../theme/surfaceStyles';
import { paymentApi } from '../../api/paymentApi';
import { payoutApi } from '../../api/payoutApi';
import { useAuth } from '../../hooks/useAuth';
import { SCREEN_NAMES } from '../../navigators/screenNames';
import { useWithdrawalRequestsRealtime } from '../../hooks/useWithdrawalRequestsRealtime';

const MIN_WITHDRAWAL = 5000;

const fmt = n =>
  `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtCompact = n =>
  `₹${parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

function getWithdrawalStatusConfig(theme) {
  const C = theme.colors;
  const S = C.surface;
  return {
    pending: { label: 'Pending', color: C.accent.warning, bg: S.accentWarning },
    processing: { label: 'Processing', color: C.accent.info, bg: 'rgba(56,189,248,0.12)' },
    completed: { label: 'Completed', color: C.accent.success, bg: S.accentSuccess },
    rejected: { label: 'Rejected', color: C.accent.error, bg: 'rgba(248,113,113,0.12)' },
  };
}
function withdrawalStatusConfig(status, theme) {
  const map = getWithdrawalStatusConfig(theme);
  return map[status] || { label: status, color: theme.colors.text.muted, bg: theme.colors.surface.accentViolet };
}

function runEntrance(opacity, translateY, delay = 0) {
  opacity.setValue(0);
  translateY.setValue(14);
  Animated.parallel([
    Animated.timing(opacity, {
      toValue: 1,
      duration: 340,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }),
    Animated.timing(translateY, {
      toValue: 0,
      duration: 340,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }),
  ]).start();
}

function FadeSlideIn({ children, delay = 0, style, replayToken = 0 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  const hasEntered = useRef(false);

  useEffect(() => {
    if (!hasEntered.current) {
      hasEntered.current = true;
      runEntrance(opacity, translateY, delay);
      return;
    }
    if (replayToken > 0) {
      runEntrance(opacity, translateY, delay);
    }
  }, [replayToken, delay, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

function PulseGlow({ color, size = 68 }) {
  const styles = useThemedStyles(createWalletStyles);
  const { theme } = useTheme();
  const ringColor = color ?? theme.colors.accent.secondary;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulseGlow,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: ringColor,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

function AnimatedBalanceText({ value, style }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    scale.setValue(0.92);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [value, scale, opacity]);

  return (
    <Animated.Text style={[style, { opacity, transform: [{ scale }] }]}>
      {value}
    </Animated.Text>
  );
}

function PulseBadge({ children, style }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View style={[style, { transform: [{ scale: pulse }] }]}>
      {children}
    </Animated.View>
  );
}

function HoverHighlight({ children, style, onPress, disabled, pressScale = 0.98, hoverScale = 1.02 }) {
  const styles = useThemedStyles(createWalletStyles);
  const scale = useRef(new Animated.Value(1)).current;
  const highlight = useRef(new Animated.Value(0)).current;
  const hovered = useRef(false);

  const springTo = useCallback(
    toValue => {
      Animated.spring(scale, {
        toValue,
        friction: 7,
        tension: 260,
        useNativeDriver: true,
      }).start();
    },
    [scale],
  );

  const setHighlight = active => {
    Animated.timing(highlight, {
      toValue: active ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const highlightOpacity = highlight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const content = (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.hoverHighlight, { opacity: highlightOpacity }]}
      />
      {children}
    </Animated.View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        if (disabled) return;
        springTo(pressScale);
        setHighlight(true);
      }}
      onPressOut={() => {
        springTo(hovered.current ? hoverScale : 1);
        if (!hovered.current) setHighlight(false);
      }}
      onHoverIn={() => {
        if (disabled) return;
        hovered.current = true;
        springTo(hoverScale);
        setHighlight(true);
      }}
      onHoverOut={() => {
        hovered.current = false;
        springTo(1);
        setHighlight(false);
      }}
    >
      {content}
    </Pressable>
  );
}

function AnimatedPressable({
  children,
  style,
  onPress,
  disabled,
  pressScale = 0.96,
  hoverScale = 1.04,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const hovered = useRef(false);

  const springTo = useCallback(
    toValue => {
      Animated.spring(scale, {
        toValue,
        friction: 7,
        tension: 260,
        useNativeDriver: true,
      }).start();
    },
    [scale],
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => !disabled && springTo(pressScale)}
      onPressOut={() => !disabled && springTo(hovered.current ? hoverScale : 1)}
      onHoverIn={() => {
        if (disabled) return;
        hovered.current = true;
        springTo(hoverScale);
      }}
      onHoverOut={() => {
        hovered.current = false;
        springTo(1);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

function SectionBlock({ icon, title, subtitle, accent, accentBg, children, delay = 0 }) {
  const styles = useThemedStyles(createWalletStyles);
  const { theme } = useTheme();
  const S = theme.colors.surface;
  const PURPLE_LINK = theme.colors.buttons.nebulaGradient[0];
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    runEntrance(opacity, translateY, delay);
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[styles.sectionBlock, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: accentBg || S.accentViolet }]}>
          <MaterialIcons name={icon} size={16} color={accent || PURPLE_LINK} />
        </View>
        <View style={styles.sectionHeaderText}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.sectionCard}>{children}</View>
    </Animated.View>
  );
}

function StatTile({ icon, label, value, color, accentBg, delay = 0, replayToken = 0 }) {
  const styles = useThemedStyles(createWalletStyles);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const hasEntered = useRef(false);

  const playEntrance = useCallback(() => {
    opacity.setValue(0);
    scale.setValue(0.92);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 180,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, scale]);

  useEffect(() => {
    if (!hasEntered.current) {
      hasEntered.current = true;
      playEntrance();
      return;
    }
    if (replayToken > 0) playEntrance();
  }, [replayToken, playEntrance]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(iconScale, {
          toValue: 1.12,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(iconScale, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [iconScale]);

  return (
    <HoverHighlight style={styles.statTileWrap} hoverScale={1.04} pressScale={0.97}>
      <Animated.View style={[styles.statTile, { opacity, transform: [{ scale }] }]}>
        <Animated.View style={[styles.statIconWrap, { backgroundColor: accentBg, transform: [{ scale: iconScale }] }]}>
          <MaterialIcons name={icon} size={18} color={color} />
        </Animated.View>
        <Text style={[styles.statValue, { color }]} numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.statLabel}>{label}</Text>
      </Animated.View>
    </HoverHighlight>
  );
}

function AnimatedProgressBar({ percent }) {
  const styles = useThemedStyles(createWalletStyles);
  const { theme } = useTheme();
  const TEAL = theme.colors.accent.secondary;
  const GOLD = theme.colors.accent.primary;
  const widthAnim = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: Math.min(Math.max(percent, 0), 100),
      duration: 900,
      delay: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [percent, widthAnim]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1600,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const barWidth = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });
  const shimmerX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, 120],
  });

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFillWrap, { width: barWidth }]}>
        <LinearGradient
          colors={[TEAL, GOLD]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.progressFill}
        />
        <Animated.View
          pointerEvents="none"
          style={[styles.progressShimmer, { transform: [{ translateX: shimmerX }] }]}
        />
      </Animated.View>
    </View>
  );
}

function ExpandFadeIn({ visible, children }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const height = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      translateY.setValue(-8);
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.spring(height, {
        toValue: 1,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, opacity, translateY, height]);

  if (!visible) return null;

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale: height }] }}>
      {children}
    </Animated.View>
  );
}

function MenuRow({ icon, title, subtitle, onPress, accent, accentBg, badge, index = 0, replayToken = 0 }) {
  const styles = useThemedStyles(createWalletStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const rowAccent = accent ?? C.accent.secondary;
  const rowAccentBg = accentBg ?? C.surface.accentTeal;
  const chevron = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const highlight = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const rowOpacity = useRef(new Animated.Value(0)).current;
  const rowY = useRef(new Animated.Value(10)).current;
  const hovered = useRef(false);
  const hasEntered = useRef(false);

  useEffect(() => {
    if (!hasEntered.current) {
      hasEntered.current = true;
      runEntrance(rowOpacity, rowY, 40 + index * 40);
      return;
    }
    if (replayToken > 0) runEntrance(rowOpacity, rowY, 40 + index * 40);
  }, [replayToken, index, rowOpacity, rowY]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(chevron, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(chevron, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [chevron]);

  const springTo = toValue => {
    Animated.spring(scale, { toValue, friction: 7, tension: 260, useNativeDriver: true }).start();
  };

  const setHighlight = active => {
    Animated.timing(highlight, {
      toValue: active ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    Animated.spring(iconScale, {
      toValue: active ? 1.1 : 1,
      friction: 6,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };

  const nudge = chevron.interpolate({ inputRange: [0, 1], outputRange: [0, 5] });
  const highlightOpacity = highlight.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Animated.View style={{ opacity: rowOpacity, transform: [{ translateY: rowY }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          springTo(0.98);
          setHighlight(true);
        }}
        onPressOut={() => {
          springTo(hovered.current ? 1.02 : 1);
          if (!hovered.current) setHighlight(false);
        }}
        onHoverIn={() => {
          hovered.current = true;
          springTo(1.02);
          setHighlight(true);
        }}
        onHoverOut={() => {
          hovered.current = false;
          springTo(1);
          setHighlight(false);
        }}
      >
        <Animated.View style={[styles.menuRow, { transform: [{ scale }] }]}>
          <Animated.View pointerEvents="none" style={[styles.menuHighlight, { opacity: highlightOpacity }]} />
          <Animated.View style={[styles.menuIcon, { backgroundColor: rowAccentBg, transform: [{ scale: iconScale }] }]}>
            <MaterialIcons name={icon} size={20} color={rowAccent} />
          </Animated.View>
          <View style={styles.menuText}>
            <Text style={styles.menuTitle}>{title}</Text>
            {subtitle ? <Text style={styles.menuSubtitle} numberOfLines={2}>{subtitle}</Text> : null}
          </View>
          {badge ? (
            <PulseBadge style={styles.menuBadge}>
              <Text style={styles.menuBadgeText}>{badge}</Text>
            </PulseBadge>
          ) : null}
          <Animated.View style={{ transform: [{ translateX: nudge }] }}>
            <MaterialIcons name="chevron-right" size={22} color={C.text.muted} />
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function QuickAmountChip({ label, active, onPress }) {
  const styles = useThemedStyles(createWalletStyles);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: active ? 1.06 : 1,
      friction: 6,
      tension: 220,
      useNativeDriver: true,
    }).start();
  }, [active, scale]);

  return (
    <AnimatedPressable
      onPress={onPress}
      style={[styles.quickChip, active && styles.quickChipActive]}
      hoverScale={1.08}
      pressScale={0.94}
    >
      <Animated.Text style={[styles.quickChipText, active && styles.quickChipTextActive, { transform: [{ scale }] }]}>
        {label}
      </Animated.Text>
    </AnimatedPressable>
  );
}

function InfoRow({ icon, label, value, valueColor }) {
  const styles = useThemedStyles(createWalletStyles);
  const { theme } = useTheme();
  const TEAL = theme.colors.accent.secondary;
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <MaterialIcons name={icon} size={17} color={TEAL} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={[styles.infoValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

function TransactionRow({ item, isMentor, index = 0, replayToken = 0 }) {
  const styles = useThemedStyles(createWalletStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const S = C.surface;
  const TEAL = C.accent.secondary;
  const net = parseFloat(item.amount || 0) - parseFloat(item.platform_fee || 0);
  const dateLabel = moment(item.created_at).format('DD MMM · hh:mm A');
  const isRecent = moment(item.created_at).isAfter(moment().subtract(7, 'days'));
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-12)).current;
  const hasEntered = useRef(false);

  useEffect(() => {
    const delay = 60 + index * 55;
    const play = () => {
      opacity.setValue(0);
      translateX.setValue(-12);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: 300,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    };
    if (!hasEntered.current) {
      hasEntered.current = true;
      play();
      return;
    }
    if (replayToken > 0) play();
  }, [replayToken, index, opacity, translateX]);

  return (
    <HoverHighlight style={styles.txRow} hoverScale={1.01} pressScale={0.99}>
      <Animated.View style={[styles.txRowInner, { opacity, transform: [{ translateX }] }]}>
        <View style={[styles.txIcon, { backgroundColor: isMentor ? S.accentSuccess : S.accentTeal }]}>
          <MaterialIcons
            name={isMentor ? 'south-west' : 'north-east'}
            size={16}
            color={isMentor ? C.accent.success : TEAL}
          />
        </View>
        <View style={styles.txBody}>
          <Text style={styles.txTitle}>{isMentor ? 'Session earning' : 'Session payment'}</Text>
          <Text style={styles.txDate}>{dateLabel}</Text>
        </View>
        <View style={styles.txRight}>
          <Text style={[styles.txAmount, isMentor && { color: C.accent.success }]}>
            {isMentor ? '+' : '-'}{fmtCompact(Math.abs(net))}
          </Text>
          {isRecent ? (
            <PulseBadge style={styles.txRecentDot}>
              <Text style={styles.txRecentText}>Recent</Text>
            </PulseBadge>
          ) : null}
        </View>
      </Animated.View>
    </HoverHighlight>
  );
}

function WithdrawalRow({ item, index = 0 }) {
  const styles = useThemedStyles(createWalletStyles);
  const { theme } = useTheme();
  const cfg = withdrawalStatusConfig(item.status, theme);
  const dateLabel = moment(item.created_at).format('DD MMM · hh:mm A');

  return (
    <View style={styles.wdRow}>
      <View style={styles.wdRowInner}>
        <View style={[styles.wdIcon, { backgroundColor: cfg.bg }]}>
          <MaterialIcons name="account-balance" size={16} color={cfg.color} />
        </View>
        <View style={styles.wdBody}>
          <View style={styles.wdTitleRow}>
            <Text style={styles.txTitle}>{fmtCompact(item.amount)}</Text>
            <View style={[styles.wdStatusPill, { backgroundColor: cfg.bg }]}>
              <Text style={[styles.wdStatusPillText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>
          <Text style={styles.txDate}>{item.upi_id || 'UPI'} · {dateLabel}</Text>
          {item.status === 'completed' && item.payout_reference ? (
            <Text style={styles.wdDetail}>Ref {item.payout_reference}</Text>
          ) : null}
          {item.status === 'rejected' && item.rejected_reason ? (
            <Text style={styles.wdDetail}>{item.rejected_reason}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function GuideRow({ icon, text, index = 0 }) {
  const styles = useThemedStyles(createWalletStyles);
  const { theme } = useTheme();
  const TEAL = theme.colors.accent.secondary;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        delay: 80 + index * 60,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 280,
        delay: 80 + index * 60,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacity, translateX]);

  return (
    <Animated.View style={[styles.guideRow, { opacity, transform: [{ translateX }] }]}>
      <MaterialIcons name={icon} size={16} color={TEAL} />
      <Text style={styles.guideText}>{text}</Text>
    </Animated.View>
  );
}

function RotatingRefreshIcon({ spinning }) {
  const { theme } = useTheme();
  const TEAL = theme.colors.accent.secondary;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!spinning) {
      spin.stopAnimation();
      spin.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spinning, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <MaterialIcons name="refresh" size={20} color={TEAL} />
    </Animated.View>
  );
}

export default function WalletScreen({ navigation }) {
  const styles = useThemedStyles(createWalletStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PURPLE_LINK = B.nebulaGradient[0];
  const PANEL_BG = C.surface.panel;
  const isLight = theme.mode === 'light';
  const balanceFade = isLight
    ? ['transparent', 'rgba(248,249,255,0.92)', PANEL_BG]
    : ['transparent', 'rgba(15,14,42,0.9)', PANEL_BG];
  const { profile } = useAuth();
  const [wallet, setWallet] = useState({ balance: 0, total_earned: 0, total_withdrawn: 0 });
  const [pendingAmount, setPendingAmount] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [withdrawalHistory, setWithdrawalHistory] = useState([]);
  const [storedUpi, setStoredUpi] = useState('');
  const [storedBankAccount, setStoredBankAccount] = useState('');
  const [storedIfsc, setStoredIfsc] = useState('');
  const [payoutReady, setPayoutReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const loadedRef = useRef(false);
  const [replayToken, setReplayToken] = useState(0);
  const bannerShimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(bannerShimmer, {
        toValue: 1,
        duration: 3200,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [bannerShimmer]);

  const bannerShimmerX = bannerShimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-180, 280],
  });

  const loadData = useCallback(
    async (silent = false) => {
      if (!profile?.id) return;
      try {
        if (!silent) setLoading(true);
        const [w, pending, payoutStatus, txs, withdrawals] = await Promise.all([
          paymentApi.getWallet(profile.id),
          paymentApi.getPendingEarnings(profile.id),
          payoutApi.getAccountStatus(profile.id).catch(err => { console.warn('⚠️ Payout status check failed:', err?.message); return null; }),
          paymentApi.getTransactions(profile.id).catch(() => []),
          paymentApi.getWithdrawalRequests(profile.id).catch(() => []),
        ]);
        setWallet(w);
        setPendingAmount(pending);
        setStoredUpi(payoutStatus?.upiId || '');
        setStoredBankAccount(payoutStatus?.bankAccount || '');
        setStoredIfsc(payoutStatus?.ifsc || '');
        setPayoutReady(payoutStatus?.status === 'active');
        setTransactions((txs || []).slice(0, 8));
        setWithdrawalHistory(withdrawals || []);
        loadedRef.current = true;
      } catch {
        Toast.show('Failed to load wallet');
      } finally {
        setLoading(false);
      }
    },
    [profile?.id],
  );

  useFocusEffect(
    useCallback(() => {
      if (!profile?.id) return;
      loadData(loadedRef.current);
    }, [profile?.id, loadData]),
  );

  useWithdrawalRequestsRealtime(profile?.id, useCallback(() => loadData(true), [loadData]));

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(true);
    setReplayToken(t => t + 1);
    setRefreshing(false);
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || Number.isNaN(amount) || amount <= 0) {
      Toast.show('Enter a valid amount');
      return;
    }
    if (amount > wallet.balance) {
      Toast.show('Amount exceeds available balance');
      return;
    }
    if (amount < MIN_WITHDRAWAL) {
      Toast.show(`Minimum withdrawal is ₹${MIN_WITHDRAWAL.toLocaleString('en-IN')}`);
      return;
    }

    const destination = storedUpi || (storedBankAccount ? `${storedBankAccount} (${storedIfsc})` : 'your saved payout details');
    Alert.alert(
      'Confirm withdrawal',
      `Send ${fmt(amount)} to\n${destination}\n\nProcessed within 1–2 business days.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setSubmitting(true);
              await paymentApi.requestWithdrawal({ mentorId: profile.id, amount });
              Toast.show("Withdrawal requested · We'll send it within 1–2 days", Toast.LONG);
              setShowWithdraw(false);
              setWithdrawAmount('');
              await loadData(true);
            } catch (e) {
              Toast.show(e.message || 'Withdrawal failed', Toast.LONG);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  const setQuickAmount = value => {
    setWithdrawAmount(String(Math.floor(value)));
  };

  const hasPayoutMethod = !!storedUpi || !!(storedBankAccount && storedIfsc);
  const canWithdraw = wallet.balance >= MIN_WITHDRAWAL && hasPayoutMethod;
  const progressPct = Math.min((wallet.balance / MIN_WITHDRAWAL) * 100, 100);
  const amountNeeded = Math.max(MIN_WITHDRAWAL - wallet.balance, 0);
  const mentorTx = transactions.filter(t => t.mentor_id === profile?.id);
  const selectedChip =
    withdrawAmount === String(MIN_WITHDRAWAL)
      ? 'Min'
      : withdrawAmount === String(Math.floor(wallet.balance))
        ? 'Max'
        : withdrawAmount === String(Math.floor(Math.max(MIN_WITHDRAWAL, wallet.balance * 0.5)))
          ? '50%'
          : null;

  return (
    <SafeScreen scrollable={false} padding={0} hasBottomTabs={false} includeTopInset={STACK_OVERLAY_LAYOUT.safeScreenIncludeTopInset}>
      <StackScreenHeader insetTop={STACK_OVERLAY_LAYOUT.headerInsetTop}>
      <FadeSlideIn delay={0} replayToken={replayToken}>
        <View style={styles.header}>
          <AnimatedPressable onPress={() => navigation.goBack()} style={styles.backBtn} hoverScale={1.08} pressScale={0.92}>
            <MaterialIcons name="arrow-back" size={22} color={C.accent.primary} />
          </AnimatedPressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>My Wallet</Text>
            <Text style={styles.headerSubtitle}>Track earnings, pending payouts & withdrawals</Text>
          </View>
          <AnimatedPressable
            onPress={handleRefresh}
            style={styles.refreshBtn}
            hoverScale={1.08}
            pressScale={0.92}
            disabled={refreshing}
          >
            {refreshing ? (
              <RotatingRefreshIcon spinning />
            ) : (
              <MaterialIcons name="refresh" size={20} color={TEAL} />
            )}
          </AnimatedPressable>
        </View>
      </FadeSlideIn>
      </StackScreenHeader>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={TEAL} colors={[TEAL]} />
        }
      >
        <FadeSlideIn delay={60} replayToken={replayToken}>
          <HoverHighlight style={styles.balanceHero} hoverScale={1.005} pressScale={0.998}>
            <LinearGradient
              colors={C.surface.heroGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.balanceBanner}
            />
            <Animated.View
              pointerEvents="none"
              style={[styles.balanceShimmer, { transform: [{ translateX: bannerShimmerX }] }]}
            />
            <LinearGradient
              colors={balanceFade}
              style={styles.balanceFade}
            />

            <View style={styles.balanceTopRow}>
              <View style={styles.balanceIconWrap}>
                <PulseGlow color={GOLD} size={72} />
                <View style={styles.balanceIconRing}>
                  <LinearGradient colors={B.premiumGradient} style={styles.balanceIconGrad}>
                    <MaterialIcons name="account-balance-wallet" size={26} color={GOLD} />
                  </LinearGradient>
                </View>
              </View>
              <View style={styles.balanceMeta}>
                <Text style={styles.balanceLabel}>Available balance</Text>
                <AnimatedBalanceText value={fmt(wallet.balance)} style={styles.balanceAmount} />
              </View>
              {payoutReady ? (
                <PulseBadge style={styles.verifiedChip}>
                  <MaterialIcons name="verified" size={13} color={C.accent.success} />
                  <Text style={styles.verifiedText}>UPI linked</Text>
                </PulseBadge>
              ) : null}
            </View>

            <Text style={styles.balanceNote}>Withdrawable after sessions complete & minimum threshold</Text>

            {pendingAmount > 0 ? (
              <PulseBadge style={styles.pendingChip}>
                <MaterialIcons name="hourglass-top" size={14} color={C.accent.warning} />
                <Text style={styles.pendingChipText}>
                  {fmt(pendingAmount)} pending · unlocks after session completion
                </Text>
              </PulseBadge>
            ) : null}
          </HoverHighlight>
        </FadeSlideIn>

        <View style={styles.statsRow}>
          <StatTile
            icon="trending-up"
            label="Total earned"
            value={fmtCompact(wallet.total_earned)}
            color={C.accent.success}
            accentBg={S.accentSuccess}
            delay={120}
            replayToken={replayToken}
          />
          <StatTile
            icon="hourglass-top"
            label="Pending"
            value={fmtCompact(pendingAmount)}
            color={C.accent.warning}
            accentBg={S.accentWarning}
            delay={170}
            replayToken={replayToken}
          />
          <StatTile
            icon="arrow-circle-up"
            label="Withdrawn"
            value={fmtCompact(wallet.total_withdrawn)}
            color={TEAL}
            accentBg={S.accentTeal}
            delay={220}
            replayToken={replayToken}
          />
        </View>

        {!hasPayoutMethod && !loading ? (
          <MenuRow
            icon="account-balance"
            title="Complete payout setup"
            subtitle="Add a UPI ID or bank account to enable withdrawals"
            onPress={() => navigation.navigate(SCREEN_NAMES.PayoutSetup)}
            accent={C.accent.warning}
            accentBg={S.accentWarning}
            badge="Required"
            replayToken={replayToken}
          />
        ) : hasPayoutMethod ? (
          <FadeSlideIn delay={260} replayToken={replayToken}>
            <HoverHighlight
              style={styles.upiCard}
              onPress={() => navigation.navigate(SCREEN_NAMES.PayoutSetup)}
              hoverScale={1.015}
              pressScale={0.99}
            >
              <View style={styles.upiLeft}>
                <MaterialIcons name={storedUpi ? 'phone-android' : 'account-balance'} size={18} color={TEAL} />
                <View>
                  <Text style={styles.upiLabel}>{storedUpi ? 'Payout UPI' : 'Payout bank account'}</Text>
                  <Text style={styles.upiValue}>{storedUpi || `${storedBankAccount} · ${storedIfsc}`}</Text>
                </View>
              </View>
              <AnimatedPressable
                onPress={() => navigation.navigate(SCREEN_NAMES.PayoutSetup)}
                style={styles.upiEditBtn}
                hoverScale={1.08}
                pressScale={0.94}
              >
                <MaterialIcons name="edit" size={16} color={GOLD} />
              </AnimatedPressable>
            </HoverHighlight>
          </FadeSlideIn>
        ) : null}

        <SectionBlock
          icon="payments"
          title="Withdraw earnings"
          subtitle={canWithdraw ? 'You can request a payout now' : `Minimum withdrawal · ${fmtCompact(MIN_WITHDRAWAL)}`}
          accent={GOLD}
          accentBg={S.accentGold}
          delay={300}
        >
          <View style={styles.withdrawHeader}>
            <Text style={styles.withdrawStatus}>
              {canWithdraw
                ? 'Your balance meets the withdrawal threshold'
                : hasPayoutMethod
                  ? `₹${amountNeeded.toLocaleString('en-IN')} more to unlock withdrawals`
                  : 'Set up a payout method to withdraw'}
            </Text>
            {canWithdraw ? (
              <PulseBadge style={styles.readyBadge}>
                <MaterialIcons name="check-circle" size={13} color={C.accent.success} />
                <Text style={styles.readyBadgeText}>Ready</Text>
              </PulseBadge>
            ) : null}
          </View>

          {!canWithdraw ? (
            <>
              <AnimatedProgressBar percent={progressPct} />
              <Text style={styles.progressCaption}>
                {fmtCompact(wallet.balance)} of {fmtCompact(MIN_WITHDRAWAL)} minimum
              </Text>
            </>
          ) : null}

          <AnimatedPressable
            onPress={() => setShowWithdraw(v => !v)}
            disabled={!canWithdraw}
            style={[styles.withdrawCta, !canWithdraw && styles.withdrawCtaDisabled]}
            hoverScale={canWithdraw ? 1.02 : 1}
            pressScale={0.97}
          >
            <LinearGradient
              colors={
                canWithdraw
                  ? B.nebulaGradient
                  : [softFill(theme), theme.colors.component.disabled]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.withdrawCtaGrad}
            >
              <MaterialIcons
                name={showWithdraw ? 'close' : 'account-balance'}
                size={18}
                color={canWithdraw ? B.nebulaText || C.text.onAccent : C.text.muted}
              />
              <Text style={[styles.withdrawCtaText, !canWithdraw && { color: C.text.muted }]}>
                {showWithdraw ? 'Cancel withdrawal' : 'Request withdrawal'}
              </Text>
            </LinearGradient>
          </AnimatedPressable>

          <ExpandFadeIn visible={showWithdraw}>
            <View style={styles.withdrawForm}>
              <Text style={styles.fieldLabel}>Sending to</Text>
              <View style={[styles.inputWrap, styles.inputReadOnly]}>
                <MaterialIcons name={storedUpi ? 'phone-android' : 'account-balance'} size={18} color={TEAL} style={styles.inputIcon} />
                <Text style={styles.upiReadOnly}>
                  {storedUpi || (storedBankAccount ? `${storedBankAccount} · ${storedIfsc}` : '—')}
                </Text>
              </View>

              <Text style={styles.fieldLabel}>Amount</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.rupeePrefix}>₹</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={withdrawAmount}
                  onChangeText={setWithdrawAmount}
                  placeholder={`Min ${fmtCompact(MIN_WITHDRAWAL)}`}
                  placeholderTextColor={C.text.muted}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.quickAmountRow}>
                {[
                  { label: 'Min', value: MIN_WITHDRAWAL },
                  { label: '50%', value: Math.max(MIN_WITHDRAWAL, wallet.balance * 0.5) },
                  { label: 'Max', value: wallet.balance },
                ].map(chip => (
                  <QuickAmountChip
                    key={chip.label}
                    label={chip.label}
                    active={selectedChip === chip.label}
                    onPress={() => setQuickAmount(chip.value)}
                  />
                ))}
              </View>

              <InfoRow icon="schedule" label="Processing time" value="1–2 business days" />
              <InfoRow
                icon="account-balance-wallet"
                label="Max withdrawable"
                value={fmt(wallet.balance)}
                valueColor={C.accent.success}
              />

              <AnimatedPressable
                onPress={handleWithdraw}
                disabled={submitting}
                style={[styles.confirmBtn, submitting && styles.confirmBtnDisabled]}
                hoverScale={1.02}
                pressScale={0.97}
              >
                <LinearGradient
                  colors={B.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.confirmBtnGrad}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={B.primaryText} />
                  ) : (
                    <>
                      <MaterialIcons name="send" size={18} color={B.primaryText} />
                      <Text style={styles.confirmBtnText}>Confirm withdrawal</Text>
                    </>
                  )}
                </LinearGradient>
              </AnimatedPressable>
            </View>
          </ExpandFadeIn>
        </SectionBlock>

        <SectionBlock
          icon="account-balance"
          title="Withdrawal history"
          subtitle={withdrawalHistory.length ? 'Your requests and their status' : 'Requests appear here once submitted'}
          accent={TEAL}
          accentBg={S.accentTeal}
          delay={340}
        >
          {withdrawalHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="account-balance" size={32} color={C.text.muted} />
              <Text style={styles.emptyTitle}>No withdrawal requests yet</Text>
              <Text style={styles.emptySubtitle}>
                Requests you submit will show up here with their status.
              </Text>
            </View>
          ) : (
            withdrawalHistory.map((item, index) => (
              <WithdrawalRow key={item.id} item={item} index={index} />
            ))
          )}
        </SectionBlock>

        <SectionBlock
          icon="receipt-long"
          title="Recent activity"
          subtitle={mentorTx.length ? 'Latest session payments' : 'Payments appear after completed bookings'}
          accent={TEAL}
          accentBg={S.accentTeal}
          delay={380}
        >
          {mentorTx.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="receipt-long" size={32} color={C.text.muted} />
              <Text style={styles.emptyTitle}>No transactions yet</Text>
              <Text style={styles.emptySubtitle}>
                Completed session payments will show up here as earnings.
              </Text>
            </View>
          ) : (
            mentorTx.map((item, index) => (
              <TransactionRow
                key={item.id}
                item={item}
                isMentor
                index={index}
                replayToken={replayToken}
              />
            ))
          )}
        </SectionBlock>

        <SectionBlock
          icon="help-outline"
          title="How earnings work"
          subtitle="Quick guide for mentors"
          accent={PURPLE_LINK}
          accentBg={S.accentViolet}
          delay={440}
        >
          <View style={styles.guideList}>
            {[
              { icon: 'event-available', text: 'Learners pay when they book your session.' },
              { icon: 'hourglass-empty', text: 'Earnings stay pending until the session is completed.' },
              { icon: 'account-balance-wallet', text: 'Available balance can be withdrawn to your UPI.' },
              { icon: 'info-outline', text: `Minimum withdrawal amount is ${fmtCompact(MIN_WITHDRAWAL)}.` },
            ].map((row, index) => (
              <GuideRow key={row.icon} icon={row.icon} text={row.text} index={index} />
            ))}
          </View>
        </SectionBlock>
      </ScrollView>

      <LoadingOverlay visible={loading && !loadedRef.current} message="Loading wallet…" />
    </SafeScreen>
  );
}

function createWalletStyles(theme) {
  const T = theme;
  const C = T.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  return StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: T.spacing.lg,
    paddingVertical: T.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(167,139,250,0.18)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: T.borderRadius.md,
    backgroundColor: S.accentViolet,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border.default,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: T.spacing.sm,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.accent.primary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: C.text.muted,
    marginTop: 2,
    textAlign: 'center',
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: T.borderRadius.md,
    backgroundColor: PANEL_BG,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.25)',
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: T.spacing.lg,
    paddingTop: T.spacing.lg,
    paddingBottom: T.spacing.xxxl,
  },
  hoverHighlight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(167,139,250,0.1)',
    borderRadius: 18,
  },
  pulseGlow: {
    position: 'absolute',
    borderWidth: 2,
  },

  balanceHero: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.25)',
    backgroundColor: PANEL_BG,
    padding: T.spacing.lg,
    marginBottom: T.spacing.lg,
  },
  balanceShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 90,
    backgroundColor: softFill(theme),
    transform: [{ skewX: '-16deg' }],
  },
  balanceBanner: {
    ...StyleSheet.absoluteFillObject,
  },
  balanceFade: {
    ...StyleSheet.absoluteFillObject,
  },
  balanceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.md,
    marginBottom: T.spacing.sm,
  },
  balanceIconWrap: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceIconRing: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  balanceIconGrad: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceMeta: { flex: 1 },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 30,
    fontWeight: '800',
    color: C.text.primary,
    letterSpacing: -0.5,
  },
  balanceNote: {
    fontSize: 13,
    color: C.text.muted,
    marginTop: 2,
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: S.accentSuccess,
    borderRadius: T.borderRadius.round,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.3)',
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.accent.success,
  },
  pendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: T.spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: S.accentWarning,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.28)',
    borderRadius: T.borderRadius.round,
    paddingHorizontal: T.spacing.md,
    paddingVertical: 6,
  },
  pendingChipText: {
    fontSize: 12,
    color: C.accent.warning,
    fontWeight: '600',
  },

  statsRow: {
    flexDirection: 'row',
    gap: T.spacing.sm,
    marginBottom: T.spacing.lg,
  },
  statTileWrap: {
    flex: 1,
  },
  statTile: {
    backgroundColor: PANEL_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
    padding: T.spacing.md,
    alignItems: 'center',
    gap: 4,
    overflow: 'hidden',
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: C.text.muted,
    textAlign: 'center',
    fontWeight: '600',
  },

  upiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: PANEL_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.25)',
    padding: T.spacing.md,
    marginBottom: T.spacing.lg,
  },
  upiLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.sm,
    flex: 1,
  },
  upiLabel: {
    fontSize: 11,
    color: C.text.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  upiValue: {
    fontSize: 14,
    color: TEAL,
    fontWeight: '700',
    marginTop: 2,
  },
  upiEditBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: S.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(240,216,117,0.3)',
  },

  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.md,
    backgroundColor: PANEL_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.28)',
    padding: T.spacing.md,
    marginBottom: T.spacing.lg,
    overflow: 'hidden',
  },
  menuHighlight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(251,191,36,0.1)',
    borderRadius: 14,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: { flex: 1 },
  menuTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text.primary,
  },
  menuSubtitle: {
    fontSize: 12,
    color: C.text.muted,
    marginTop: 2,
  },
  menuBadge: {
    backgroundColor: S.accentWarning,
    borderRadius: T.borderRadius.round,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
  },
  menuBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: C.accent.warning,
    textTransform: 'uppercase',
  },

  sectionBlock: {
    marginBottom: T.spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.sm,
    marginBottom: T.spacing.sm,
    paddingHorizontal: 2,
  },
  sectionIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: { flex: 1 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text.primary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: C.text.muted,
    marginTop: 1,
  },
  sectionCard: {
    backgroundColor: PANEL_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    padding: T.spacing.lg,
    gap: T.spacing.md,
  },

  withdrawHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: T.spacing.sm,
  },
  withdrawStatus: {
    flex: 1,
    fontSize: 13,
    color: C.text.secondary,
    lineHeight: 18,
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: S.accentSuccess,
    borderRadius: T.borderRadius.round,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.3)',
  },
  readyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.accent.success,
  },
  progressTrack: {
    height: 8,
    backgroundColor: softFill(theme),
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFillWrap: {
    height: '100%',
    minWidth: 8,
  },
  progressFill: {
    flex: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 36,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  progressCaption: {
    fontSize: 12,
    color: C.text.muted,
    marginTop: -4,
  },
  withdrawCta: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  withdrawCtaDisabled: {
    opacity: 0.72,
  },
  withdrawCtaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.spacing.sm,
    paddingVertical: T.spacing.md,
  },
  withdrawCtaText: {
    fontSize: 15,
    fontWeight: '800',
    color: B.nebulaText || C.text.onAccent,
  },

  withdrawForm: {
    gap: T.spacing.sm,
    paddingTop: T.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(167,139,250,0.15)',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: PURPLE_LINK,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INPUT_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    paddingHorizontal: T.spacing.md,
  },
  inputReadOnly: {
    backgroundColor: 'rgba(94,234,212,0.06)',
    borderColor: 'rgba(94,234,212,0.22)',
  },
  inputIcon: { marginRight: T.spacing.sm },
  rupeePrefix: {
    fontSize: 15,
    color: TEAL,
    fontWeight: '800',
    marginRight: T.spacing.sm,
  },
  fieldInput: {
    flex: 1,
    paddingVertical: T.spacing.sm + 2,
    color: C.text.primary,
    fontSize: 15,
  },
  upiReadOnly: {
    flex: 1,
    paddingVertical: T.spacing.sm + 2,
    color: TEAL,
    fontSize: 14,
    fontWeight: '600',
  },
  quickAmountRow: {
    flexDirection: 'row',
    gap: T.spacing.sm,
    marginBottom: T.spacing.xs,
  },
  quickChip: {
    paddingHorizontal: T.spacing.md,
    paddingVertical: 6,
    borderRadius: T.borderRadius.round,
    backgroundColor: S.accentViolet,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.3)',
  },
  quickChipActive: {
    backgroundColor: S.accentGold,
    borderColor: 'rgba(240,216,117,0.55)',
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: PURPLE_LINK,
  },
  quickChipTextActive: {
    color: GOLD,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(167,139,250,0.15)',
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.sm,
  },
  infoLabel: {
    fontSize: 13,
    color: C.text.muted,
  },
  infoValue: {
    fontSize: 13,
    color: C.text.primary,
    fontWeight: '700',
  },
  confirmBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: T.spacing.xs,
  },
  confirmBtnDisabled: {
    opacity: 0.7,
  },
  confirmBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: T.spacing.md,
    borderWidth: 1,
    borderColor: B.primaryBorder,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: B.primaryText,
  },

  txRow: {
    borderRadius: 12,
    marginBottom: 2,
    overflow: 'hidden',
  },
  txRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.sm,
    paddingVertical: T.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(167,139,250,0.12)',
  },
  txIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txBody: { flex: 1 },
  txTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text.primary,
  },
  txDate: {
    fontSize: 11,
    color: C.text.muted,
    marginTop: 2,
  },
  txRight: { alignItems: 'flex-end' },
  txAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: C.text.primary,
  },
  txRecentDot: {
    marginTop: 3,
    backgroundColor: S.accentTeal,
    borderRadius: T.borderRadius.round,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  txRecentText: {
    fontSize: 9,
    fontWeight: '700',
    color: TEAL,
    textTransform: 'uppercase',
  },

  wdRow: {
    borderRadius: 12,
    marginBottom: 2,
    overflow: 'hidden',
  },
  wdRowInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: T.spacing.sm,
    paddingVertical: T.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(167,139,250,0.12)',
  },
  wdIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wdBody: { flex: 1 },
  wdTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: T.spacing.xs,
  },
  wdStatusPill: {
    borderRadius: T.borderRadius.round,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  wdStatusPillText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  wdDetail: {
    fontSize: 11,
    color: C.text.muted,
    marginTop: 2,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: T.spacing.lg,
    gap: T.spacing.sm,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text.primary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: C.text.muted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: T.spacing.md,
  },

  guideList: { gap: T.spacing.sm },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: T.spacing.sm,
  },
  guideText: {
    flex: 1,
    fontSize: 13,
    color: C.text.secondary,
    lineHeight: 18,
  },
  });
}
