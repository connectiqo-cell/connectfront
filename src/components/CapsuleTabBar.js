import React, { Fragment } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { UNIFIED_THEME } from '../unifiedTheme';
import { useTheme, useThemedStyles } from '../hooks/useTheme';
import { scaleUi } from '../utils/iosUiScale';

const T = UNIFIED_THEME;
const C = T.colors;
const B = C.buttons;
const TB = C.tabBar;

const PURPLE_LINK = B.nebulaGradient[0];
const GOLD = C.accent.primary;
const TEAL = C.accent.secondary;

/**
 * Material top tabs — cosmic sector layout with glass bar and rounded icon tiles.
 */
export const CosmicTopTabBar = ({ state, descriptors, navigation, compact = false }) => {
  const styles = useThemedStyles(createThemedStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const B = C.buttons;
  const TB = C.tabBar;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const useScroll = state.routes.length > 4;

  const TabInner = ({ route, index }) => {
    const { options } = descriptors[route.key];
    const label =
      typeof options.tabBarLabel === 'string'
        ? options.tabBarLabel
        : options.title ?? route.name;
    const isFocused = state.index === index;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    const iconColor = isFocused ? (compact ? PURPLE_LINK : GOLD) : C.text.secondary;
    const labelColor = isFocused ? (compact ? PURPLE_LINK : GOLD) : C.text.muted;

    const iconNode = options.tabBarIcon
      ? options.tabBarIcon({ focused: isFocused, color: iconColor })
      : null;

    if (compact) {
      return (
        <View style={[styles.tabColumn, useScroll && styles.tabColumnScroll]}>
          <TouchableOpacity
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={typeof label === 'string' ? label : route.name}
            onPress={onPress}
            activeOpacity={0.85}
            style={styles.tabHitCompact}
          >
            <View style={styles.tabContentCompact}>
              {iconNode ? (
                <View style={styles.iconSlotCompact}>{iconNode}</View>
              ) : null}
              <Text
                style={[styles.labelCompact, { color: labelColor }, isFocused && styles.labelFocused]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
              >
                {label}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View
        style={[styles.tabColumn, useScroll && styles.tabColumnScroll]}
      >
        {isFocused ? (
          <LinearGradient
            colors={TB.topNavActiveWash}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            pointerEvents="none"
          />
        ) : null}

        <TouchableOpacity
          accessibilityRole="tab"
          accessibilityState={{ selected: isFocused }}
          accessibilityLabel={typeof label === 'string' ? label : route.name}
          onPress={onPress}
          activeOpacity={0.85}
          style={styles.tabHit}
        >
          <View style={styles.tabContent}>
            {iconNode ? (
              isFocused ? (
                <LinearGradient
                  colors={TB.topNavIconRing}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconRing}
                >
                  <View style={styles.iconRingInner}>{iconNode}</View>
                </LinearGradient>
              ) : (
                <View style={styles.iconSlot}>{iconNode}</View>
              )
            ) : null}
            <Text
              style={[
                styles.label,
                { color: labelColor },
                isFocused && styles.labelFocused,
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              {label}
            </Text>
          </View>
        </TouchableOpacity>

      </View>
    );
  };

  const tabsRow = useScroll ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      bounces={false}
    >
      {state.routes.map((route, index) => (
        <TabInner key={route.key} route={route} index={index} />
      ))}
    </ScrollView>
  ) : (
    <View style={styles.row}>
      {state.routes.map((route, index) => (
        <Fragment key={route.key}>
          <TabInner route={route} index={index} />
          {index < state.routes.length - 1 ? (
            <View style={styles.tabDivider} />
          ) : null}
        </Fragment>
      ))}
    </View>
  );

  return (
    <View style={styles.skyRoot}>
      <LinearGradient
        colors={C.primary.gradient}
        locations={C.cosmic.mainGradientLocations}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={C.cosmic.nebulaHaze}
        locations={C.cosmic.nebulaLocations}
        start={{ x: 0.15, y: 1 }}
        end={{ x: 0.85, y: 0 }}
        style={[StyleSheet.absoluteFill, styles.skyHaze]}
        pointerEvents="none"
      />
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={[styles.barShell, Platform.OS === 'ios' && styles.barShellIos]}>
          <View style={styles.barTint} pointerEvents="none">
            <LinearGradient
              colors={TB.glassGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>

          {/* <LinearGradient
            colors={TB.flatBarEdge}
            locations={[0, 0.35, 0.65, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.auroraTop}
            pointerEvents="none"
          /> */}
          <LinearGradient
            colors={TB.flatBarEdge}
            locations={[0, 0.35, 0.65, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.auroraBottom}
            pointerEvents="none"
          />

          <View style={styles.barInner}>{tabsRow}</View>
        </View>
      </SafeAreaView>
    </View>
  );
};

function createThemedStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const TB = C.tabBar;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  return StyleSheet.create({
  skyRoot: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: C.primary.void,
  },
  skyHaze: {
    opacity: C.cosmic.hazeOpacity * 0.72,
  },
  safeTop: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  barShell: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: TB.flatBarBase,
    borderBottomWidth: 1,
    borderBottomColor: C.border.light,
    paddingTop: T.spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: UNIFIED_THEME.shadows.medium.shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: UNIFIED_THEME.shadows.medium.shadowOpacity * 0.7,
        shadowRadius: UNIFIED_THEME.shadows.medium.shadowRadius,
      },
      android: { elevation: UNIFIED_THEME.shadows.medium.elevation },
    }),
  },
  barShellIos: {
    paddingTop: T.spacing.xs,
  },
  barTint: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.88,
  },
  auroraTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 2,
    opacity: 0.95,
    zIndex: 2,
  },
  auroraBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    opacity: 0.75,
    zIndex: 2,
  },
  barInner: {
    zIndex: 1,
    paddingBottom: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: T.spacing.md,
    gap: T.spacing.sm,
  },
  tabDivider: {
    width: StyleSheet.hairlineWidth * 2,
    alignSelf: 'stretch',
    marginVertical: T.spacing.md + 2,
    backgroundColor: C.border.light,
    opacity: theme.mode === 'light' ? 1 : 0.6,
  },
  tabColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  tabColumnScroll: {
    flex: 0,
    minWidth: 92,
    maxWidth: 118,
  },
  // activeWash: {
  //   ...StyleSheet.absoluteFillObject,
  //   marginHorizontal: 2,
  //   marginVertical: 4,
  //   borderRadius: T.borderRadius.md,
  //   opacity: 0.95,
  //   marginBottom: T.spacing.sm,
  // },
  tabHit: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: T.spacing.sm,
    paddingHorizontal: T.spacing.xs,
    minHeight: Platform.OS === 'ios' ? scaleUi(52) : 52,
    zIndex: 1,
  },
  tabContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  iconSlot: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconRing: {
    width: 40,
    height: 40,
    borderRadius: T.borderRadius.md,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconRingInner: {
    flex: 1,
    width: '100%',
    borderRadius: T.borderRadius.sm,
    backgroundColor: C.surface.sheet,
    borderWidth: 1,
    borderColor: TB.rimBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    ...T.typography.labelSm,
    fontWeight: '600',
    letterSpacing: 0.25,
    textAlign: 'center',
    width: '100%',
  },
  labelFocused: {
    fontWeight: '800',
    textShadowColor: TB.labelShadow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  beamRow: {
    width: '100%',
    paddingHorizontal: T.spacing.sm,
    alignItems: 'center',
  },
  beamSlot: {
    width: '100%',
    height: 3,
  },
  beam: {
    width: '100%',
    height: 3,
    borderRadius: 2,
  },
  tabHitCompact: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: T.spacing.xs + 2,
    paddingHorizontal: T.spacing.xs,
    minHeight: 48,
    zIndex: 1,
  },
  tabContentCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  iconSlotCompact: {
    width: 20,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelCompact: {
    ...T.typography.labelSm,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
}

