import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { BRAND_LOGO } from '../utils/brandLogo';
import { getFloatingTabBarHeight } from './CosmicBottomTabBar';

const TAB_COUNT = 5; // bottom tabs in UnifiedTabNavigator

/**
 * App tour shown once after first login. Edit the text here.
 * `tab` = index of the bottom tab the step spotlights; leave it out for a
 * centred card. `points` = rows under the body ({ icon, title, text }).
 * `logo: true` shows the app logo on a centred card instead of `icon`.
 * Bump the key suffix to show a guide again to everyone (e.g. after editing).
 */
export const APP_TOUR_KEY = 'first_time_guide_seen_v5';
export const APP_TOUR_STEPS = [
  {
    logo: true,
    title: 'Welcome to Connectiqo',
    body: 'Learn one-to-one from creators who have done it before.',
    points: [
      { icon: 'videocam', title: 'Live video sessions', text: 'Book a private call with any creator' },
      { icon: 'play-circle-outline', title: 'Creator videos', text: 'Watch lessons creators have uploaded' },
      { icon: 'chat', title: 'Messages', text: 'Chat with a creator before or after you book' },
      { icon: 'school', title: 'Teach and earn', text: 'Become a creator yourself' },
    ],
    cta: 'Take a quick tour',
  },
  {
    tab: 0,
    icon: 'home',
    title: 'Home',
    body: 'Your starting point. See creators recommended for your interests and jump back into what you were doing.',
  },
  {
    tab: 1,
    icon: 'search',
    title: 'Search',
    body: 'Find creators by name or category, watch their videos, and see all the sessions you have booked.',
  },
  {
    tab: 2,
    lift: 22, // Upload button floats above the bar, so only its window is taller
    icon: 'file-upload',
    title: 'Upload',
    body: 'Share what you know. Upload a video to your own channel so others can find you.',
  },
  {
    tab: 3,
    icon: 'person',
    title: 'Me',
    body: 'Your creator side. See the calls others booked with you, your earnings, and set the time slots you are free.',
  },
  {
    tab: 4,
    icon: 'settings',
    title: 'Settings',
    body: 'Your profile, wallet, messages, notifications, recorded sessions and payment history.',
  },
  {
    icon: 'rocket-launch',
    title: 'Book your first session',
    body: 'It takes four steps.',
    numbered: true,
    points: [
      { title: 'Find a creator', text: 'Open Search and tap a creator to see their profile' },
      { title: 'Pick a time', text: 'Tap Book and choose a free slot' },
      { title: 'Pay to confirm', text: 'Secure checkout confirms your booking' },
      { title: 'Join the call', text: 'Open your bookings at the session time' },
    ],
    cta: 'Get started',
  },
];

/** Shown once, the first time a user opens another mentor's profile. */
export const MENTOR_PROFILE_KEY = 'mentor_profile_guide_seen_v2';
export const MENTOR_PROFILE_STEPS = [
  {
    icon: 'person-search',
    title: 'This is a creator profile',
    body: 'Here is what the buttons on this page do.',
    points: [
      { icon: 'chat', title: 'Chat (purple, top right)', text: 'Message this creator' },
      { icon: 'event', title: 'Book', text: 'Pick a time slot for a video session' },
      { icon: 'play-circle-outline', title: 'Videos', text: 'Watch free ones, or subscribe to unlock the rest' },
      { icon: 'share', title: 'Share', text: 'Send this profile to someone' },
      { icon: 'flag', title: 'Flag', text: 'Report this profile to us' },
    ],
    cta: 'Got it',
  },
];

const DIM = 'rgba(4, 2, 14, 0.82)';
const ARROW = 10;
const CARD_MARGIN = 16;
/** Spotlight window around the real tab: side inset, and how far it rises above the bar. */
const SPOT_INSET = 3;
const SPOT_LIFT = 2; // a step can override with `lift`

/**
 * One-time guide overlay. Rendered as a sibling over the screen (not a Modal)
 * so it shares the tab bar's coordinate space — tabs are equal columns, so a
 * step can spotlight the real tab without measuring anything.
 */
export default function FirstTimeGuide({ storageKey = APP_TOUR_KEY, steps = APP_TOUR_STEPS }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [step, setStep] = useState(-1); // -1 = hidden

  useEffect(() => {
    AsyncStorage.getItem(storageKey)
      .then((seen) => { if (!seen) setStep(0); })
      .catch(() => {});
  }, [storageKey]);

  if (step < 0) return null;

  const finish = () => {
    setStep(-1);
    AsyncStorage.setItem(storageKey, '1').catch(() => {});
  };
  const isLast = step === steps.length - 1;
  const next = () => (isLast ? finish() : setStep(step + 1));

  const C = theme.colors;
  const gradient = C.buttons.nebulaGradient;
  const accent = gradient[0];
  const tint = C.surface.accentViolet;
  const current = steps[step];
  const onTab = typeof current.tab === 'number';

  const barH = getFloatingTabBarHeight(insets);
  const colW = width / TAB_COUNT;
  const spotLeft = onTab ? colW * current.tab + SPOT_INSET : 0;
  const spotW = colW - SPOT_INSET * 2;
  const spotH = barH + (current.lift ?? SPOT_LIFT);

  const dots = steps.length > 1 ? (
    <View style={styles.dots}>
      {steps.map((s, i) => (
        <View
          key={s.title}
          style={[styles.dot, { backgroundColor: i === step ? accent : C.border.default }, i === step && styles.dotActive]}
        />
      ))}
    </View>
  ) : null;

  const gradientButton = (label, style) => (
    <Pressable onPress={next} style={style}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnFill}>
        <Text style={styles.btnText}>{label}</Text>
        {isLast ? null : <MaterialIcons name="arrow-forward" size={16} color="#fff" />}
      </LinearGradient>
    </Pressable>
  );

  if (onTab) {
    return (
      <View style={styles.overlay} accessibilityViewIsModal>
        {/* Dim everything except a window over the real tab. */}
        <Pressable style={[styles.dimPart, { top: 0, left: 0, right: 0, bottom: spotH }]} onPress={next} />
        <Pressable style={[styles.dimPart, { left: 0, bottom: 0, width: spotLeft, height: spotH }]} onPress={next} />
        <Pressable style={[styles.dimPart, { left: spotLeft + spotW, right: 0, bottom: 0, height: spotH }]} onPress={next} />
        {/* Outline on the window; also blocks taps on the tab during the tour. */}
        <Pressable
          onPress={next}
          style={[styles.spot, { left: spotLeft, width: spotW, height: spotH, borderColor: accent, shadowColor: accent }]}
        />

        <View
          pointerEvents="none"
          style={[
            styles.arrow,
            { left: colW * (current.tab + 0.5) - ARROW, bottom: spotH + 6, borderTopColor: C.surface.panel },
          ]}
        />
        <View
          style={[
            styles.card,
            styles.tipCard,
            { bottom: spotH + 6 + ARROW, backgroundColor: C.surface.panel, borderColor: C.border.default },
          ]}
        >
          <View style={styles.tipHead}>
            <View style={[styles.tile, { backgroundColor: tint }]}>
              <MaterialIcons name={current.icon} size={20} color={accent} />
            </View>
            <Text style={[styles.tipTitle, { color: C.text.primary }]}>{current.title}</Text>
          </View>
          <Text style={[styles.tipBody, { color: C.text.secondary }]}>{current.body}</Text>
          <View style={styles.tipFooter}>
            {dots}
            <View style={styles.tipActions}>
              <Pressable onPress={finish} hitSlop={10}>
                <Text style={[styles.skip, { color: C.text.muted }]}>Skip</Text>
              </Pressable>
              {gradientButton('Next', styles.btnSmall)}
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <View style={[styles.dimPart, StyleSheet.absoluteFill]} />
      <View style={styles.center}>
        <View style={[styles.card, styles.bigCard, { backgroundColor: C.surface.panel, borderColor: C.border.default }]}>
          {current.logo ? (
            <Image source={BRAND_LOGO} style={styles.logo} resizeMode="contain" />
          ) : (
            <View style={[styles.heroIcon, { backgroundColor: tint }]}>
              <MaterialIcons name={current.icon} size={30} color={accent} />
            </View>
          )}
          <Text style={[styles.bigTitle, { color: C.text.primary }]}>{current.title}</Text>
          <Text style={[styles.bigBody, { color: C.text.secondary }]}>{current.body}</Text>

          <View style={styles.points}>
            {(current.points || []).map((point, i) => (
              <View key={point.title} style={styles.point}>
                <View style={[styles.tile, { backgroundColor: tint }]}>
                  {current.numbered ? (
                    <Text style={[styles.number, { color: accent }]}>{i + 1}</Text>
                  ) : (
                    <MaterialIcons name={point.icon} size={20} color={accent} />
                  )}
                </View>
                <View style={styles.pointBody}>
                  <Text style={[styles.pointTitle, { color: C.text.primary }]}>{point.title}</Text>
                  <Text style={[styles.pointText, { color: C.text.secondary }]}>{point.text}</Text>
                </View>
              </View>
            ))}
          </View>

          {gradientButton(current.cta || (isLast ? 'Got it' : 'Next'), styles.btnWide)}
          {isLast ? null : (
            <Pressable onPress={finish} hitSlop={10} style={styles.skipWide}>
              <Text style={[styles.skip, { color: C.text.muted }]}>Skip for now</Text>
            </Pressable>
          )}
          {dots ? <View style={styles.bigDots}>{dots}</View> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 1000, elevation: 1000 },
  dimPart: { position: 'absolute', backgroundColor: DIM },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 22 },
  spot: {
    position: 'absolute',
    bottom: 0,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowOpacity: 0.9,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  arrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: ARROW,
    borderRightWidth: ARROW,
    borderTopWidth: ARROW,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  card: { borderRadius: 20, borderWidth: 1 },

  // Tooltip card (tab steps)
  tipCard: { position: 'absolute', left: CARD_MARGIN, right: CARD_MARGIN, padding: 16 },
  tipHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  tipTitle: { fontSize: 18, fontWeight: '800' },
  tipBody: { fontSize: 14, lineHeight: 21 },
  tipFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  tipActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },

  // Centred card (welcome / finish / screen tips)
  bigCard: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 18, alignItems: 'center' },
  logo: { width: 84, height: 84, marginBottom: 14 },
  heroIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  bigTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  bigBody: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 6 },
  points: { alignSelf: 'stretch', marginTop: 18, gap: 12 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pointBody: { flex: 1 },
  pointTitle: { fontSize: 14, fontWeight: '700' },
  pointText: { fontSize: 12.5, lineHeight: 17, marginTop: 1 },
  tile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  number: { fontSize: 16, fontWeight: '800' },
  bigDots: { marginTop: 14 },
  skipWide: { marginTop: 12 },

  dots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 16 },
  skip: { fontSize: 14, fontWeight: '600' },
  btnWide: { alignSelf: 'stretch', marginTop: 20, borderRadius: 14, overflow: 'hidden' },
  btnSmall: { borderRadius: 999, overflow: 'hidden' },
  btnFill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
