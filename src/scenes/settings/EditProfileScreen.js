import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  StyleSheet,
  ScrollView,
  Alert,
  Animated,
  Easing,
  Keyboard,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import Toast from 'react-native-simple-toast';
import { pickProfileAvatar, pickProfileCover } from '../../utils/pickProfileAvatar';
import { UNIFIED_THEME } from '../../unifiedTheme';
import { SafeScreen } from '../../components/SafeScreen';
import StackScreenHeader from '../../components/StackScreenHeader';
import { STACK_OVERLAY_LAYOUT } from '../../utils/platformLayout';
import { useSystemBack } from '../../hooks/useSystemBack';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { useAuth } from '../../hooks/useAuth';
import { profileApi } from '../../api/profileApi';
import { supabase } from '../../lib/supabase';
import { MENTOR_CATEGORIES } from '../../constants/mentorCategories';
import { fetchActiveCategoryNames } from '../../api/contentApi';
import {
  formatSelectedCategoriesLabel,
  parseMentorCategories,
  serializeMentorCategories,
  toggleMentorCategory,
} from '../../utils/mentorCategories';
import { CelebrationScreenFx } from '../../components/CelebrationPayButton';
import { CircularProfileImage } from '../../components/CircularGradientFrame';
import { useAvatarPreview } from '../../contexts/AvatarPreviewContext';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const T = UNIFIED_THEME;
const C = T.colors;
const B = C.buttons;
const S = C.surface;

const PURPLE_LINK = B.nebulaGradient[0];
const GOLD = C.accent.primary;
const TEAL = C.accent.secondary;
const PANEL_BG = '#161432';
const INPUT_BG = '#0f0e2a';

const BIO_MAX = 280;
const NAME_MAX = 60;

function calcCompletion(fields) {
  const checks = [
    !!fields.name?.trim(),
    !!fields.username?.trim(),
    !!fields.learnerBio?.trim(),
    !!fields.interests?.trim(),
    !!fields.specialization?.trim(),
    !!fields.mentorBio?.trim(),
    !!fields.experienceYears?.trim(),
    !!fields.pricePerHour?.trim(),
    !!fields.categories?.length,
    !!fields.coverImageUrl?.trim(),
    !!fields.avatarUrl?.trim(),
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
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

function FadeSlideIn({ children, delay = 0, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    runEntrance(opacity, translateY, delay);
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>
  );
}

function AvatarGlowRing() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.avatarGlowRing, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
    />
  );
}

function SectionBlock({ icon, title, subtitle, accent, accentBg, children, delay = 0 }) {
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
      <View style={styles.card}>{children}</View>
    </Animated.View>
  );
}

function CategoryChip({ label, active, onPress, index }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 260,
        delay: index * 35,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 200,
        delay: index * 35,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacity, scale]);

  return (
    <Animated.View style={{ opacity, transform: [{ scale }] }}>
      <AnimatedPressable
        style={[styles.categoryChip, active && styles.categoryChipActive]}
        onPress={onPress}
        hoverScale={1.06}
        pressScale={0.94}
      >
        <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{label}</Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

function CategoryDropdown({ categories, open, onToggle, options, onToggleCategory }) {
  const selected = parseMentorCategories(categories);
  const summary = formatSelectedCategoriesLabel(selected);

  const chevron = useRef(new Animated.Value(0)).current;
  const hovered = useRef(false);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(chevron, {
      toValue: open ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, chevron]);

  const chevronRotate = chevron.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const springTo = v => {
    Animated.spring(scale, { toValue: v, friction: 7, tension: 260, useNativeDriver: true }).start();
  };

  return (
    <View style={styles.fieldWrap}>
      <View style={styles.fieldLabelRow}>
        <View style={styles.fieldLabelLeft}>
          <MaterialIcons name="category" size={14} color={C.text.muted} />
          <Text style={styles.fieldLabel}>Categories</Text>
        </View>
        <Text style={styles.fieldHint}>Select all that apply</Text>
      </View>
      <Pressable
        onPress={onToggle}
        onPressIn={() => springTo(0.98)}
        onPressOut={() => springTo(hovered.current ? 1.01 : 1)}
        onHoverIn={() => {
          hovered.current = true;
          springTo(1.01);
        }}
        onHoverOut={() => {
          hovered.current = false;
          springTo(1);
        }}
      >
        <Animated.View style={[styles.dropdownTrigger, { transform: [{ scale }] }]}>
          <Text style={summary ? styles.dropdownValue : styles.dropdownPlaceholder}>
            {summary || 'Choose your mentoring categories'}
          </Text>
          <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
            <MaterialIcons name="expand-more" size={22} color={C.text.muted} />
          </Animated.View>
        </Animated.View>
      </Pressable>
      {open ? (
        <View style={styles.categoryGrid}>
          {options.map((cat, index) => (
            <CategoryChip
              key={cat}
              label={cat}
              active={selected.some(c => c.toLowerCase() === cat.toLowerCase())}
              index={index}
              onPress={() => onToggleCategory(cat)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Field({
  icon,
  label,
  value,
  onChangeText,
  placeholder,
  readOnly,
  hint,
  error,
  multiline,
  isLast,
  keyboardType,
  maxLength,
  required,
  autoCorrect = true,
  autoCapitalize = 'sentences',
}) {
  const charCount = typeof value === 'string' ? value.length : 0;

  return (
    <View style={[styles.fieldWrap, isLast && styles.fieldWrapLast]}>
      <View style={styles.fieldLabelRow}>
        <View style={styles.fieldLabelLeft}>
          {icon ? <MaterialIcons name={icon} size={14} color={C.text.muted} /> : null}
          <Text style={styles.fieldLabel}>
            {label}
            {required ? <Text style={styles.fieldRequired}> *</Text> : null}
          </Text>
        </View>
        {maxLength && !readOnly ? (
          <Text style={[styles.charCount, charCount >= maxLength && styles.charCountMax]}>
            {charCount}/{maxLength}
          </Text>
        ) : null}
      </View>
      {readOnly ? (
        <View style={styles.readOnlyBox}>
          <Text style={styles.readOnlyText}>{value}</Text>
          <MaterialIcons name="lock-outline" size={14} color={C.text.disabled} />
        </View>
      ) : (
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline, error && styles.inputError]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.text.disabled}
          multiline={multiline}
          numberOfLines={multiline ? 4 : 1}
          keyboardType={keyboardType || 'default'}
          autoCorrect={autoCorrect}
          spellCheck={autoCorrect}
          autoCapitalize={autoCapitalize}
          textAlignVertical={multiline ? 'top' : 'center'}
          maxLength={maxLength}
        />
      )}
      {hint ? <Text style={[styles.fieldHint, error && styles.fieldHintError]}>{hint}</Text> : null}
    </View>
  );
}

function CompletionBar({ percent }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const widthAnim = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(widthAnim, {
        toValue: clamped,
        friction: 8,
        tension: 50,
        useNativeDriver: false,
      }),
    ]).start();
  }, [clamped, opacity, widthAnim]);

  const fillWidth = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.completionWrap, { opacity }]}>
      <View style={styles.completionTop}>
        <Text style={styles.completionLabel}>Profile completeness</Text>
        <Text style={styles.completionPct}>{clamped}%</Text>
      </View>
      <View style={styles.completionTrack}>
        <Animated.View style={[styles.completionFillWrap, { width: fillWidth }]}>
          <LinearGradient
            colors={B.premiumGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.completionFill}
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

function AnimatedFooter({ children, insets }) {
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      friction: 8,
      tension: 70,
      delay: 120,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  return (
    <Animated.View
      style={[
        styles.footer,
        {
          paddingBottom: Math.max(insets.bottom, T.spacing.md),
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const VIOLET = '#a78bfa';
const SPARKLE_COUNT = 10;
const SPARKLE_COLORS = [GOLD, TEAL, VIOLET, '#f472b6', B.nebulaGradient[0], B.primaryGradient[1]];

function buildSaveSparkles() {
  return Array.from({ length: SPARKLE_COUNT }, (_, i) => ({
    id: i,
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    opacity: new Animated.Value(0),
    scale: new Animated.Value(0),
    rotate: new Animated.Value(0),
    angle: (i / SPARKLE_COUNT) * Math.PI * 2 + (i % 2) * 0.35,
    distance: 22 + (i % 4) * 14,
    color: SPARKLE_COLORS[i % SPARKLE_COLORS.length],
    size: i % 3 === 0 ? 6 : 4,
  }));
}

function AnimatedSaveButton({ saving, saveSuccess, disabled, onPress, onSuccessComplete, onSuccessMeasure }) {
  const btnScale = useRef(new Animated.Value(1)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const labelOpacity = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const iconWiggle = useRef(new Animated.Value(0)).current;
  const wrapRef = useRef(null);
  const sparkles = useRef(buildSaveSparkles()).current;
  const onSuccessCompleteRef = useRef(onSuccessComplete);
  const didCompleteRef = useRef(false);

  useEffect(() => {
    onSuccessCompleteRef.current = onSuccessComplete;
  }, [onSuccessComplete]);

  useEffect(() => {
    if (!saveSuccess || !wrapRef.current) return undefined;
    const timer = setTimeout(() => {
      wrapRef.current?.measureInWindow((x, y, w, h) => {
        onSuccessMeasure?.({ x: x + w / 2, y: y + h / 2 });
      });
    }, 40);
    return () => clearTimeout(timer);
  }, [saveSuccess, onSuccessMeasure]);

  useEffect(() => {
    if (!saveSuccess) {
      didCompleteRef.current = false;
      return undefined;
    }

    checkScale.setValue(0);
    labelOpacity.setValue(0);
    shimmer.setValue(0);
    ring2.setValue(0);
    ring3.setValue(0);
    iconWiggle.setValue(0);
    sparkles.forEach(s => {
      s.x.setValue(0);
      s.y.setValue(0);
      s.opacity.setValue(0);
      s.scale.setValue(0);
      s.rotate.setValue(0);
    });

    const finish = () => {
      if (didCompleteRef.current) return;
      didCompleteRef.current = true;
      onSuccessCompleteRef.current?.();
    };

    const fallback = setTimeout(finish, 2800);

    const sparkleAnims = sparkles.map(s =>
      Animated.parallel([
        Animated.sequence([
          Animated.timing(s.opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
          Animated.delay(280),
          Animated.timing(s.opacity, { toValue: 0, duration: 380, useNativeDriver: true }),
        ]),
        Animated.spring(s.scale, { toValue: 1, friction: 5, tension: 220, useNativeDriver: true }),
        Animated.timing(s.x, {
          toValue: Math.cos(s.angle) * s.distance,
          duration: 720,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(s.y, {
          toValue: Math.sin(s.angle) * s.distance - 18,
          duration: 720,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(s.rotate, { toValue: 1, duration: 720, useNativeDriver: true }),
      ]),
    );

    const anim = Animated.sequence([
      Animated.spring(btnScale, {
        toValue: 1.1,
        friction: 4,
        tension: 220,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.spring(checkScale, {
          toValue: 1,
          friction: 5,
          tension: 280,
          useNativeDriver: true,
        }),
        Animated.timing(labelOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(80),
          Animated.timing(ring2, {
            toValue: 1,
            duration: 620,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(160),
          Animated.timing(ring3, {
            toValue: 1,
            duration: 720,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(iconWiggle, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(iconWiggle, { toValue: 0, duration: 280, useNativeDriver: true }),
          Animated.timing(iconWiggle, { toValue: 0.6, duration: 200, useNativeDriver: true }),
          Animated.timing(iconWiggle, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]),
        ...sparkleAnims,
      ]),
      Animated.delay(700),
      Animated.timing(btnScale, {
        toValue: 1,
        duration: 220,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    anim.start(({ finished }) => {
      if (finished) {
        clearTimeout(fallback);
        finish();
      }
    });

    return () => {
      clearTimeout(fallback);
      anim.stop();
    };
  }, [saveSuccess, btnScale, checkScale, labelOpacity, shimmer, ring2, ring3, iconWiggle, sparkles]);

  const ringScale = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.75, 1.35],
  });
  const ringOpacity = shimmer.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0.65, 0],
  });
  const ring2Scale = ring2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.55],
  });
  const ring2Opacity = ring2.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0.45, 0],
  });
  const ring3Scale = ring3.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.75],
  });
  const ring3Opacity = ring3.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0.3, 0],
  });
  const wiggleRotate = iconWiggle.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '-14deg', '12deg'],
  });

  if (saveSuccess) {
    return (
      <Animated.View
        ref={wrapRef}
        collapsable={false}
        style={[styles.saveBtnWrap, { transform: [{ scale: btnScale }] }]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.saveSuccessRing,
            styles.saveRingTeal,
            { opacity: ringOpacity, transform: [{ scale: ringScale }] },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.saveSuccessRing,
            styles.saveRingGold,
            { opacity: ring2Opacity, transform: [{ scale: ring2Scale }] },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.saveSuccessRing,
            styles.saveRingViolet,
            { opacity: ring3Opacity, transform: [{ scale: ring3Scale }] },
          ]}
        />

        <View style={styles.saveSparkleLayer} pointerEvents="none">
          {sparkles.map(s => {
            const spin = s.rotate.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', `${140 + s.id * 18}deg`],
            });
            return (
              <Animated.View
                key={s.id}
                style={[
                  styles.saveSparkle,
                  {
                    width: s.size,
                    height: s.size,
                    borderRadius: s.size / 2,
                    backgroundColor: s.color,
                    opacity: s.opacity,
                    transform: [
                      { translateX: s.x },
                      { translateY: s.y },
                      { scale: s.scale },
                      { rotate: spin },
                    ],
                  },
                ]}
              />
            );
          })}
        </View>

        <LinearGradient
          colors={[GOLD, TEAL, VIOLET]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.saveSuccessBtn}
        >
          <Animated.View style={{ transform: [{ scale: checkScale }, { rotate: wiggleRotate }] }}>
            <MaterialIcons name="celebration" size={24} color={B.primaryText || C.text.onAccent} />
          </Animated.View>
          <Animated.Text style={[styles.saveSuccessText, { opacity: labelOpacity }]}>Profile saved!</Animated.Text>
          <Animated.View style={{ opacity: labelOpacity, transform: [{ scale: checkScale }] }}>
            <MaterialIcons name="auto-awesome" size={16} color={B.primaryText || C.text.onAccent} />
          </Animated.View>
        </LinearGradient>
      </Animated.View>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || saving}
      activeOpacity={0.88}
      style={styles.saveBtn}
      accessibilityRole="button"
      accessibilityLabel="Save changes"
    >
      <LinearGradient
        colors={disabled || saving ? B.disabledGradient || ['#3a3860', '#2e2c4a'] : B.primaryGradient}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.saveBtnGradient}
      >
        {saving ? (
          <ActivityIndicator size="small" color={B.primaryText || C.text.onAccent} />
        ) : (
          <Text style={styles.saveBtnText}>Save changes</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function EditProfileScreen({ navigation }) {
  const { showAvatarPreview } = useAvatarPreview();
  const insets = useSafeAreaInsets();
  const { profile, user, refreshProfile } = useAuth();
  const userId = profile?.id ?? user?.id;
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [loading, setLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [celebrationOrigin, setCelebrationOrigin] = useState({
    x: SCREEN_W / 2,
    y: SCREEN_H - 100,
  });

  const [name, setName] = useState(profile?.name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [usernameError, setUsernameError] = useState('');
  const [learnerBio, setLearnerBio] = useState('');
  const [interests, setInterests] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [mentorBio, setMentorBio] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [pricePerHour, setPricePerHour] = useState('');
  const [categories, setCategories] = useState([]);
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [adminCategoryNames, setAdminCategoryNames] = useState([]);

  const savedSnapshot = useRef(null);

  const mentorCategoryOptions = useMemo(() => {
    if (adminCategoryNames?.length) return adminCategoryNames;
    return MENTOR_CATEGORIES;
  }, [adminCategoryNames]);

  const completion = useMemo(
    () =>
      calcCompletion({
        name,
        username,
        learnerBio,
        interests,
        specialization,
        mentorBio,
        experienceYears,
        pricePerHour,
        categories,
        coverImageUrl,
        avatarUrl,
      }),
    [
      name,
      username,
      learnerBio,
      interests,
      specialization,
      mentorBio,
      experienceYears,
      pricePerHour,
      categories,
      coverImageUrl,
      avatarUrl,
    ],
  );

  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        name: name.trim(),
        username: username.trim().toLowerCase(),
        learnerBio: learnerBio.trim(),
        interests: interests.trim(),
        specialization: specialization.trim(),
        mentorBio: mentorBio.trim(),
        experienceYears: experienceYears.trim(),
        pricePerHour: pricePerHour.trim(),
        categories,
        coverImageUrl,
        avatarUrl,
      }),
    [
      name,
      username,
      learnerBio,
      interests,
      specialization,
      mentorBio,
      experienceYears,
      pricePerHour,
      categories,
      coverImageUrl,
      avatarUrl,
    ],
  );

  const hasUnsavedChanges = savedSnapshot.current != null && savedSnapshot.current !== currentSnapshot;

  const markSaved = useCallback(() => {
    savedSnapshot.current = currentSnapshot;
  }, [currentSnapshot]);

  useEffect(() => {
    let cancelled = false;
    fetchActiveCategoryNames().then(names => {
      if (!cancelled) setAdminCategoryNames(names || []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadProfiles = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setProfileReady(false);
      return;
    }
    try {
      setLoading(true);

      const [mentorData, learnerData] = await Promise.allSettled([
        profileApi.getMentorProfile(userId),
        profileApi.getLearnerProfile(userId),
      ]);

      let nextSpecialization = '';
      let nextMentorBio = '';
      let nextExperienceYears = '';
      let nextPricePerHour = '';
      let nextCategories = [];
      let nextCover = '';
      let nextLearnerBio = '';
      let nextInterests = '';

      if (mentorData.status === 'fulfilled' && mentorData.value) {
        const m = mentorData.value;
        nextSpecialization = m.specialization || '';
        nextMentorBio = m.bio || '';
        nextExperienceYears = m.experience_years ? String(m.experience_years) : '';
        nextPricePerHour = m.price_per_hour ? String(m.price_per_hour) : '';
        nextCategories = parseMentorCategories(m.category || '');
        nextCover = m.cover_image_url || '';
      }
      if (learnerData.status === 'fulfilled' && learnerData.value) {
        const l = learnerData.value;
        nextLearnerBio = l.bio || '';
        nextInterests = Array.isArray(l.interests) ? l.interests.join(', ') : l.interests || '';
      }

      setAvatarUrl(profile.avatar_url || '');
      setName(profile.name || '');
      setUsername(profile.username || '');
      setSpecialization(nextSpecialization);
      setMentorBio(nextMentorBio);
      setExperienceYears(nextExperienceYears);
      setPricePerHour(nextPricePerHour);
      setCategories(nextCategories);
      setCoverImageUrl(nextCover);
      setLearnerBio(nextLearnerBio);
      setInterests(nextInterests);

      savedSnapshot.current = JSON.stringify({
        name: (profile.name || '').trim(),
        username: (profile.username || '').trim().toLowerCase(),
        learnerBio: nextLearnerBio.trim(),
        interests: nextInterests.trim(),
        specialization: nextSpecialization.trim(),
        mentorBio: nextMentorBio.trim(),
        experienceYears: nextExperienceYears.trim(),
        pricePerHour: nextPricePerHour.trim(),
        categories: nextCategories,
        coverImageUrl: nextCover,
        avatarUrl: profile.avatar_url || '',
      });
    } catch (error) {
      console.error('Failed to load profiles:', error);
      Toast.show('Could not load profile details');
    } finally {
      setLoading(false);
      setProfileReady(true);
    }
  }, [userId]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    if (!profile?.id || profile.id !== userId) return;
    setAvatarUrl(prev => prev || profile.avatar_url || '');
    setName(prev => prev || profile.name || '');
    setUsername(prev => prev || profile.username || '');
  }, [profile?.id, profile?.name, profile?.username, profile?.avatar_url, userId]);

  const handleGoBack = () => {
    if (saving || saveSuccess) return;
    if (!hasUnsavedChanges) {
      navigation.goBack();
      return;
    }
    Alert.alert('Discard changes?', 'You have unsaved edits. Leave without saving?', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  useSystemBack(navigation, handleGoBack);

  const handlePickImage = async (source) => {
    try {
      const picked = await pickProfileAvatar({ source });
      if (!picked) return;
      setLoading(true);
      const url = await profileApi.uploadAvatar({
        userId,
        base64: picked.base64,
        mimeType: picked.mimeType,
        fileName: picked.fileName,
      });
      setAvatarUrl(url);
      await refreshProfile();
      Toast.show('Photo updated');
    } catch {
      Toast.show('Failed to upload photo');
    } finally {
      setLoading(false);
    }
  };

  const handlePickCover = async () => {
    try {
      const picked = await pickProfileCover();
      if (!picked) return;
      setLoading(true);
      const url = await profileApi.uploadCoverImage({
        userId,
        base64: picked.base64,
        mimeType: picked.mimeType,
        fileName: picked.fileName,
      });
      setCoverImageUrl(url);
      Toast.show('Cover updated');
    } catch (e) {
      Toast.show(e?.message || 'Failed to upload cover', Toast.LONG);
    } finally {
      setLoading(false);
    }
  };

  const validateUsername = useCallback(
    async val => {
      const clean = val.trim().toLowerCase();
      if (!clean) {
        setUsernameError('Username is required');
        return { valid: false, message: 'Username is required' };
      }
      if (!/^[a-z0-9_]{3,30}$/.test(clean)) {
        const message = '3–30 characters: letters, numbers, underscores only';
        setUsernameError(message);
        return { valid: false, message };
      }
      if (clean !== profile?.username) {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', clean)
          .maybeSingle();
        if (data) {
          const message = 'Username is already taken';
          setUsernameError(message);
          return { valid: false, message };
        }
      }
      setUsernameError('');
      return { valid: true };
    },
    [profile?.username],
  );

  const handleSuccessAnimationDone = useCallback(() => {
    Toast.show('Profile saved successfully');
    navigation.goBack();
  }, [navigation]);

  const handleDeleteProfile = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account, profile, and all associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              `Type DELETE to confirm. Your account for ${profile?.email || 'this user'} will be permanently removed.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete my account',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      setLoading(true);
                      await supabase.rpc('delete_user');
                      // Auth user is now deleted — use scope:'local' so we only
                      // clear the local token without making a server round-trip
                      // (the server would 404 since the user no longer exists).
                      await supabase.auth.signOut({ scope: 'local' });
                      navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
                    } catch (err) {
                      console.error('Delete account error:', err?.message || err);
                      Toast.show(err?.message || 'Failed to delete account. Contact support.');
                    } finally {
                      setLoading(false);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }, [profile?.email, navigation]);

  const handleSave = async () => {
    Keyboard.dismiss();
    if (!userId) {
      Toast.show('Sign in to save your profile');
      return;
    }
    if (!profileReady) {
      Toast.show('Profile is still loading');
      return;
    }
    if (!name.trim()) {
      Toast.show('Please enter your name');
      return;
    }
    const usernameResult = await validateUsername(username);
    if (!usernameResult.valid) {
      Toast.show(usernameResult.message || 'Please fix your username');
      return;
    }

    try {
      setSaving(true);
      setSaveSuccess(false);
      await Promise.all([
        profileApi.updateProfile({
          userId,
          name: name.trim(),
          username: username.trim().toLowerCase(),
        }),
        profileApi.updateMentorProfile({
          userId,
          specialization,
          bio: mentorBio,
          experienceYears: parseInt(experienceYears, 10) || 0,
          pricePerHour: parseFloat(pricePerHour) || 0,
          coverImageUrl,
          category: serializeMentorCategories(categories),
        }),
        profileApi.updateLearnerProfile({
          userId,
          bio: learnerBio,
          interests: interests
            .split(',')
            .map(i => i.trim())
            .filter(Boolean),
        }),
      ]);
      markSaved();
      setSaveSuccess(true);
      refreshProfile?.();
    } catch (err) {
      console.error('Save profile error:', err?.message || err);
      Toast.show(err?.message || 'Failed to save profile');
      setSaveSuccess(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeScreen scrollable={false} padding={0} hasBottomTabs={false} includeTopInset={STACK_OVERLAY_LAYOUT.safeScreenIncludeTopInset}>
      <StackScreenHeader insetTop={STACK_OVERLAY_LAYOUT.headerInsetTop}>
      <FadeSlideIn delay={0}>
        <View style={styles.header}>
          <AnimatedPressable onPress={handleGoBack} style={styles.backBtn} hoverScale={1.08} pressScale={0.92}>
            <MaterialIcons name="arrow-back" size={22} color={C.text.primary} />
          </AnimatedPressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <Text style={styles.headerSubtitle}>Update how others see you on Connectiqo</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
      </FadeSlideIn>
      </StackScreenHeader>

      <View style={styles.pageBody}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <FadeSlideIn delay={50}>
          <View style={styles.heroCard}>
            <AnimatedPressable
              onPress={handlePickCover}
              disabled={loading}
              style={styles.coverBanner}
              hoverScale={1.01}
              pressScale={0.99}
            >
              {coverImageUrl ? (
                <Image source={{ uri: coverImageUrl }} style={styles.coverImage} resizeMode="cover" />
              ) : (
                <LinearGradient
                  colors={['rgba(124,58,237,0.35)', 'rgba(94,234,212,0.2)', PANEL_BG]}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <LinearGradient
                colors={['transparent', 'rgba(15,14,42,0.85)', PANEL_BG]}
                style={styles.coverFade}
              />
              <View style={styles.coverEditChip}>
                <MaterialIcons name="photo-camera" size={14} color={TEAL} />
                <Text style={styles.coverEditText}>{coverImageUrl ? 'Change cover' : 'Add cover photo'}</Text>
              </View>
            </AnimatedPressable>

            <View style={styles.heroBody}>
              <AnimatedPressable
                onPress={() => {
                  if (avatarUrl) {
                    showAvatarPreview({ uri: avatarUrl, name: name.trim() || 'Your profile' });
                  } else {
                    handlePickImage();
                  }
                }}
                disabled={loading}
                style={styles.avatarTouchable}
                hoverScale={1.05}
                pressScale={0.94}
              >
                <AvatarGlowRing />
                <CircularProfileImage
                  size={94}
                  ringWidth={3}
                  colors={B.premiumGradient}
                  innerBg={C.primary.void}
                  uri={avatarUrl}
                  previewName={name.trim() || 'Your profile'}
                  pressable={false}
                  imageProps={{ key: avatarUrl, cache: 'reload' }}
                  fallback={
                    <View style={[styles.avatarPlaceholder, styles.avatarFallbackEdit]}>
                      <MaterialIcons name="person" size={40} color={PURPLE_LINK} />
                    </View>
                  }
                />
                <TouchableOpacity
                  style={styles.avatarCamera}
                  onPress={() => handlePickImage('camera')}
                  disabled={loading}
                  activeOpacity={0.85}
                  accessibilityLabel="Take profile photo"
                >
                  <MaterialIcons name="camera-alt" size={14} color={C.text.primary} />
                </TouchableOpacity>
              </AnimatedPressable>

              <Text style={styles.heroName} numberOfLines={1}>
                {name.trim() || 'Your name'}
              </Text>
              <Text style={styles.heroUsername} numberOfLines={1}>
                @{username.trim() || 'username'}
              </Text>
              {profile?.email ? (
                <Text style={styles.heroEmail} numberOfLines={1}>{profile.email}</Text>
              ) : null}

              <CompletionBar percent={completion} />
            </View>
          </View>
        </FadeSlideIn>

        <View style={styles.body}>
          <SectionBlock
            icon="person"
            title="Personal information"
            subtitle="Name and public username"
            accent={TEAL}
            accentBg={S.accentTeal}
            delay={120}
          >
            <Field
              icon="badge"
              label="Full name"
              value={name}
              onChangeText={setName}
              placeholder="How you appear to others"
              maxLength={NAME_MAX}
              required
            />
            <Field
              icon="alternate-email"
              label="Username"
              value={username}
              onChangeText={v => {
                setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                setUsernameError('');
              }}
              placeholder="your_username"
              hint={usernameError || 'Unique handle for your public profile'}
              error={!!usernameError}
              maxLength={30}
              autoCorrect={false}
              autoCapitalize="none"
              required
            />
            <Field
              icon="email"
              label="Email"
              value={profile?.email}
              readOnly
              hint="Contact support to change your email"
              isLast
            />
          </SectionBlock>

          <SectionBlock
            icon="school"
            title="Learner profile"
            subtitle="Help mentors understand your goals"
            accent={TEAL}
            accentBg={S.accentTeal}
            delay={200}
          >
            <Field
              icon="info-outline"
              label="About you"
              value={learnerBio}
              onChangeText={setLearnerBio}
              placeholder="What are you learning? What do you need help with?"
              multiline
              maxLength={BIO_MAX}
            />
            <Field
              icon="interests"
              label="Interests"
              value={interests}
              onChangeText={setInterests}
              placeholder="React, Python, UI Design…"
              hint="Separate topics with commas"
              isLast
            />
          </SectionBlock>

          <SectionBlock
            icon="workspace-premium"
            title="Mentor profile"
            subtitle="Shown on your mentor page and in search"
            accent={GOLD}
            accentBg={S.accentGold}
            delay={280}
          >
            <Field
              icon="stars"
              label="Specialization"
              value={specialization}
              onChangeText={setSpecialization}
              placeholder="e.g. Full Stack Developer"
              maxLength={80}
            />
            <Field
              icon="info-outline"
              label="Professional bio"
              value={mentorBio}
              onChangeText={setMentorBio}
              placeholder="Experience, teaching style, what learners can expect"
              multiline
              maxLength={BIO_MAX}
            />
            <View style={styles.rowFields}>
              <View style={styles.rowFieldHalf}>
                <Field
                  icon="event-note"
                  label="Experience"
                  value={experienceYears}
                  onChangeText={v => setExperienceYears(v.replace(/[^0-9]/g, ''))}
                  placeholder="Years"
                  keyboardType="numeric"
                  hint="Years of experience"
                  isLast
                />
              </View>
              <View style={styles.rowFieldHalf}>
                <Field
                  icon="currency-rupee"
                  label="Session rate"
                  value={pricePerHour}
                  onChangeText={v => setPricePerHour(v.replace(/[^0-9.]/g, ''))}
                  placeholder="₹ per session"
                  keyboardType="decimal-pad"
                  hint="Session booking rate"
                  isLast
                />
              </View>
            </View>

            <CategoryDropdown
              categories={categories}
              open={showCategoryPicker}
              onToggle={() => setShowCategoryPicker(v => !v)}
              options={mentorCategoryOptions}
              onToggleCategory={cat => setCategories(prev => toggleMentorCategory(prev, cat))}
            />
          </SectionBlock>

          <FadeSlideIn delay={360} style={styles.dangerZone}>
            <View style={styles.dangerZoneHeader}>
              <MaterialIcons name="warning" size={14} color="#ef4444" />
              <Text style={styles.dangerZoneTitle}>Danger Zone</Text>
            </View>
            <View style={styles.dangerZoneCard}>
              <View style={styles.dangerZoneInfo}>
                <Text style={styles.dangerZoneHeading}>Delete Account</Text>
                <Text style={styles.dangerZoneSubtitle}>
                  Permanently remove your account and all associated data. This cannot be undone.
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleDeleteProfile}
                activeOpacity={0.82}
                style={styles.deleteBtn}
                accessibilityRole="button"
                accessibilityLabel="Delete account"
              >
                <MaterialIcons name="delete-forever" size={18} color="#ef4444" />
                <Text style={styles.deleteBtnText}>Delete Account</Text>
              </TouchableOpacity>
            </View>
          </FadeSlideIn>
        </View>
      </ScrollView>

      <AnimatedFooter insets={insets}>
        {hasUnsavedChanges && !saveSuccess ? (
          <Text style={styles.unsavedHint}>You have unsaved changes</Text>
        ) : null}
        <AnimatedSaveButton
          saving={saving}
          saveSuccess={saveSuccess}
          disabled={saveSuccess}
          onPress={handleSave}
          onSuccessComplete={handleSuccessAnimationDone}
          onSuccessMeasure={setCelebrationOrigin}
        />
      </AnimatedFooter>
      </View>

      <LoadingOverlay visible={!profileReady && !saving} message="Loading profile…" />

      <CelebrationScreenFx
        active={saveSuccess}
        origin={celebrationOrigin}
        loop={false}
        theme="cosmic"
      />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: PANEL_BG,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: T.spacing.sm,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.text.primary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: C.text.muted,
    marginTop: 2,
    textAlign: 'center',
  },
  headerSpacer: { width: 40 },
  pageBody: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: T.spacing.lg,
  },
  heroCard: {
    backgroundColor: PANEL_BG,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(167,139,250,0.18)',
    marginBottom: T.spacing.lg,
  },
  coverBanner: {
    height: 130,
    backgroundColor: INPUT_BG,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  coverImage: {
    ...StyleSheet.absoluteFillObject,
  },
  coverFade: {
    ...StyleSheet.absoluteFillObject,
  },
  coverEditChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
    margin: T.spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(15,14,42,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.3)',
  },
  coverEditText: {
    fontSize: 12,
    fontWeight: '700',
    color: TEAL,
  },
  heroBody: {
    alignItems: 'center',
    paddingHorizontal: T.spacing.lg,
    paddingBottom: T.spacing.lg,
    marginTop: -48,
  },
  avatarTouchable: {
    position: 'relative',
    marginBottom: T.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGlowRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: TEAL,
  },
  avatarRing: {
    padding: 3,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  avatarFallbackEdit: {
    width: 88,
    height: 88,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.primary.void,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCamera: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: PANEL_BG,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  heroName: {
    fontSize: 20,
    fontWeight: '800',
    color: C.text.primary,
    marginTop: 4,
  },
  heroUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: GOLD,
    marginTop: 2,
  },
  heroEmail: {
    fontSize: 12,
    color: C.text.muted,
    marginTop: 2,
    marginBottom: T.spacing.sm,
  },
  completionWrap: {
    width: '100%',
    marginTop: T.spacing.md,
    padding: T.spacing.md,
    borderRadius: 12,
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.18)',
  },
  completionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  completionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.text.secondary,
  },
  completionPct: {
    fontSize: 12,
    fontWeight: '800',
    color: TEAL,
  },
  completionTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(167,139,250,0.15)',
    overflow: 'hidden',
  },
  completionFillWrap: {
    height: '100%',
    overflow: 'hidden',
    borderRadius: 3,
  },
  completionFill: {
    flex: 1,
    height: '100%',
    borderRadius: 3,
  },
  body: {
    paddingHorizontal: T.spacing.lg,
  },
  sectionBlock: {
    marginBottom: T.spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: T.spacing.sm,
    marginBottom: T.spacing.sm,
    paddingHorizontal: T.spacing.xs,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.15)',
  },
  sectionHeaderText: {
    flex: 1,
    paddingTop: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text.primary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: C.text.muted,
    marginTop: 2,
    lineHeight: 17,
  },
  card: {
    backgroundColor: PANEL_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
    paddingHorizontal: T.spacing.lg,
    overflow: 'hidden',
  },
  fieldWrap: {
    paddingVertical: T.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(167,139,250,0.12)',
  },
  fieldWrapLast: {
    borderBottomWidth: 0,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  fieldLabelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fieldRequired: {
    color: C.accent.error,
  },
  charCount: {
    fontSize: 11,
    color: C.text.muted,
    fontWeight: '600',
  },
  charCountMax: {
    color: GOLD,
  },
  input: {
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
    borderRadius: 12,
    paddingHorizontal: T.spacing.md,
    paddingVertical: T.spacing.sm,
    color: C.text.primary,
    fontSize: 15,
    minHeight: 46,
  },
  inputMultiline: {
    minHeight: 100,
    paddingTop: T.spacing.sm,
    lineHeight: 22,
  },
  inputError: {
    borderColor: 'rgba(239,68,68,0.5)',
  },
  readOnlyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.12)',
    borderRadius: 12,
    paddingHorizontal: T.spacing.md,
    paddingVertical: T.spacing.sm,
    minHeight: 46,
    opacity: 0.75,
  },
  readOnlyText: {
    color: C.text.secondary,
    fontSize: 15,
    flex: 1,
  },
  fieldHint: {
    fontSize: 11,
    color: C.text.muted,
    marginTop: 6,
    lineHeight: 16,
  },
  fieldHintError: {
    color: C.accent.error,
  },
  rowFields: {
    flexDirection: 'row',
    gap: T.spacing.sm,
  },
  rowFieldHalf: {
    flex: 1,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
    borderRadius: 12,
    paddingHorizontal: T.spacing.md,
    paddingVertical: T.spacing.sm,
    minHeight: 46,
  },
  dropdownValue: {
    fontSize: 15,
    color: C.text.primary,
    flex: 1,
  },
  dropdownPlaceholder: {
    fontSize: 15,
    color: C.text.disabled,
    flex: 1,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: T.spacing.sm,
    paddingBottom: T.spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
  },
  categoryChipActive: {
    backgroundColor: S.accentGold,
    borderColor: 'rgba(240,216,117,0.35)',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text.secondary,
  },
  categoryChipTextActive: {
    color: GOLD,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: T.spacing.lg,
    paddingTop: T.spacing.sm,
    backgroundColor: 'rgba(15,14,42,0.96)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(167,139,250,0.18)',
  },
  unsavedHint: {
    fontSize: 12,
    color: GOLD,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  saveBtn: {
    width: '100%',
    marginVertical: 0,
    borderRadius: 14,
    overflow: 'hidden',
  },
  saveBtnGradient: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: T.spacing.lg,
    borderWidth: 1,
    borderColor: B.primaryBorder,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: B.primaryText || C.text.onAccent,
    letterSpacing: 0.3,
  },
  saveBtnWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  saveSparkleLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 3,
  },
  saveSparkle: {
    position: 'absolute',
  },
  saveSuccessRing: {
    position: 'absolute',
    width: '100%',
    height: 52,
    borderRadius: 14,
    borderWidth: 2,
  },
  saveRingTeal: {
    borderColor: TEAL,
  },
  saveRingGold: {
    borderColor: GOLD,
  },
  saveRingViolet: {
    borderColor: VIOLET,
  },
  saveSuccessBtn: {
    width: '100%',
    minHeight: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(240, 216, 117, 0.55)',
    zIndex: 2,
    ...T.shadows?.medium,
  },
  saveSuccessText: {
    fontSize: 16,
    fontWeight: '800',
    color: B.primaryText || C.text.onAccent,
    letterSpacing: 0.4,
  },
  dangerZone: {
    marginTop: T.spacing.md,
    marginBottom: T.spacing.xl,
  },
  dangerZoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: T.spacing.sm,
    paddingHorizontal: T.spacing.xs,
  },
  dangerZoneTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ef4444',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dangerZoneCard: {
    backgroundColor: 'rgba(239,68,68,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    padding: T.spacing.lg,
    gap: T.spacing.md,
  },
  dangerZoneInfo: {
    gap: 4,
  },
  dangerZoneHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text.primary,
  },
  dangerZoneSubtitle: {
    fontSize: 13,
    color: C.text.muted,
    lineHeight: 18,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
    backgroundColor: 'rgba(239,68,68,0.08)',
    paddingVertical: 12,
    paddingHorizontal: T.spacing.lg,
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ef4444',
  },
});
