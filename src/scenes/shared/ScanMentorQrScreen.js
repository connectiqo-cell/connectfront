import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Camera, CameraType } from 'react-native-camera-kit';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-simple-toast';
import ViewShot from 'react-native-view-shot';
import { StackActions, useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ProfileQrCode from '../../components/ProfileQrCode';
import { mentorApi } from '../../api/mentorApi';
import { useAuth } from '../../hooks/useAuth';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { SCREEN_NAMES } from '../../navigators/screenNames';
import {
  ensureCameraPermission,
  openAppCameraSettings,
} from '../../utils/cameraPermission';
import {
  copyMentorShareUrl,
  getMentorShareLink,
  parseMentorShareIdentifier,
  shareMentorQrImage,
} from '../../utils/shareProfile';

const FALLBACK_W = Dimensions.get('window').width || 360;

function readCodeValue(event) {
  return (
    event?.nativeEvent?.codeStringValue
    || event?.codeStringValue
    || event?.nativeEvent?.data
    || (typeof event === 'string' ? event : null)
  );
}

/**
 * Profile QR screen:
 *  - Default: show QR + Share / Copy / Scan actions
 *  - Scan: camera (no bottom Code|Scan tabs)
 */
export default function ScanMentorQrScreen({ navigation, route }) {
  const styles = useThemedStyles(createStyles);
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { width: winW } = useWindowDimensions();
  const { user, profile } = useAuth();

  const [mode, setMode] = useState('code'); // 'code' | 'scan'
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [permission, setPermission] = useState('checking');
  const [torchOn, setTorchOn] = useState(false);
  const [opening, setOpening] = useState(false);
  const handlingRef = useRef(false);
  const lastBadToastAt = useRef(0);
  const qrCardRef = useRef(null);

  const mentorId = route.params?.mentorId || profile?.id || user?.id || null;
  const displayName =
    route.params?.mentorName
    || route.params?.name
    || profile?.name
    || 'Creator';
  const username = route.params?.username ?? profile?.username ?? null;
  const specialization = route.params?.specialization || null;
  const handle = username ? `@${String(username).trim()}` : null;

  const shareUrl = useMemo(
    () => (mentorId ? getMentorShareLink(username, mentorId) : ''),
    [username, mentorId],
  );

  const layoutW = winW > 0 ? winW : FALLBACK_W;
  const cardWidth = Math.min(320, Math.max(260, Math.round(layoutW - 48)));
  const qrSize = 220;
  const logoSize = 36;

  useEffect(() => {
    if (mode !== 'scan') return undefined;
    let alive = true;
    (async () => {
      setPermission('checking');
      const ok = await ensureCameraPermission();
      if (alive) setPermission(ok ? 'granted' : 'denied');
    })();
    return () => {
      alive = false;
    };
  }, [mode]);

  useEffect(() => {
    if (mode === 'scan' && !opening) {
      handlingRef.current = false;
    }
  }, [mode, opening]);

  const showBadToast = useCallback((message) => {
    const now = Date.now();
    if (now - lastBadToastAt.current < 2200) return;
    lastBadToastAt.current = now;
    Toast.show(message, Toast.SHORT);
  }, []);

  const openMentorProfile = useCallback(
    async (identifier) => {
      setOpening(true);
      try {
        const resolvedId = await mentorApi.resolveMentorId(identifier);
        if (!resolvedId) {
          showBadToast('Profile not found');
          handlingRef.current = false;
          setOpening(false);
          return;
        }
        navigation.dispatch(
          StackActions.replace(SCREEN_NAMES.MentorProfile, {
            mentorId: resolvedId,
          }),
        );
      } catch {
        showBadToast('Could not open profile');
        handlingRef.current = false;
        setOpening(false);
      }
    },
    [navigation, showBadToast],
  );

  const onReadCode = useCallback(
    (event) => {
      if (!isFocused || mode !== 'scan' || handlingRef.current || opening) return;
      const value = readCodeValue(event);
      if (!value) return;
      const identifier = parseMentorShareIdentifier(value);
      if (!identifier) {
        showBadToast('Not a Connectiqo profile QR');
        return;
      }
      handlingRef.current = true;
      openMentorProfile(identifier);
    },
    [isFocused, mode, opening, openMentorProfile, showBadToast],
  );

  const handleCopy = async () => {
    const ok = await copyMentorShareUrl(shareUrl);
    if (ok) {
      setCopied(true);
      Toast.show('Link copied', Toast.SHORT);
      setTimeout(() => setCopied(false), 1600);
    } else {
      Toast.show('Could not copy link', Toast.SHORT);
    }
  };

  const handleShare = useCallback(async () => {
    if (!shareUrl || sharing) return;
    setSharing(true);
    try {
      let imageUri = null;
      if (qrCardRef.current?.capture) {
        imageUri = await qrCardRef.current.capture();
      }
      await shareMentorQrImage({
        name: displayName,
        username,
        mentorId,
        imageUri,
      });
    } catch {
      Toast.show('Could not share QR', Toast.SHORT);
    } finally {
      setSharing(false);
    }
  }, [shareUrl, sharing, displayName, username, mentorId]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a12" />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => {
            if (mode === 'scan') {
              setMode('code');
              setTorchOn(false);
              return;
            }
            navigation.goBack();
          }}
          style={styles.circleBtn}
          hitSlop={10}
          accessibilityLabel={mode === 'scan' ? 'Back to QR' : 'Close'}
        >
          <MaterialIcons
            name={mode === 'scan' ? 'arrow-back' : 'close'}
            size={22}
            color="#fff"
          />
        </Pressable>
        <Text style={styles.topTitle}>
          {mode === 'scan' ? 'Scan QR code' : 'QR code'}
        </Text>
        {mode === 'scan' ? (
          <Pressable
            onPress={() => setTorchOn(v => !v)}
            style={styles.circleBtn}
            hitSlop={10}
            disabled={permission !== 'granted' || opening}
            accessibilityLabel="Toggle flashlight"
          >
            <MaterialIcons
              name={torchOn ? 'flash-on' : 'flash-off'}
              size={22}
              color="#fff"
            />
          </Pressable>
        ) : (
          <View style={styles.circleBtnPlaceholder} />
        )}
      </View>

      <View style={styles.body}>
        {mode === 'code' ? (
          <View
            style={[styles.codePane, { paddingBottom: Math.max(insets.bottom, 16) }]}
            collapsable={false}
          >
            <ViewShot
              ref={qrCardRef}
              options={{
                format: 'png',
                quality: 1,
                result: 'tmpfile',
                fileName: 'connectiqo-qr',
              }}
              style={[styles.card, { width: cardWidth }]}
            >
              <View collapsable={false} style={styles.qrBox}>
                {shareUrl ? (
                  <ProfileQrCode
                    value={shareUrl}
                    size={qrSize}
                    color="#000000"
                    backgroundColor="#ffffff"
                    quietZone={12}
                    logoRatio={logoSize / 200}
                    showLogo
                  />
                ) : (
                  <View style={[styles.qrFallback, { width: qrSize, height: qrSize }]}>
                    <MaterialIcons name="qr-code-2" size={64} color="#999" />
                    <Text style={styles.qrFallbackTxt}>No link available</Text>
                  </View>
                )}
              </View>

              <Text style={styles.cardName} numberOfLines={1}>{displayName}</Text>
              {handle ? (
                <Text style={styles.cardHandle} numberOfLines={1}>{handle}</Text>
              ) : specialization ? (
                <Text style={styles.cardHandle} numberOfLines={1}>{specialization}</Text>
              ) : null}

              {shareUrl ? (
                <Pressable onPress={handleCopy} style={styles.linkPill}>
                  <MaterialIcons name="link" size={14} color="#555" />
                  <Text style={styles.linkPillTxt} numberOfLines={2} selectable>
                    {shareUrl}
                  </Text>
                </Pressable>
              ) : null}
            </ViewShot>

            <Text style={styles.hint}>
              Share this QR — others can scan it with any camera or in Connectiqo
            </Text>

            <View style={styles.actionsRow}>
              <ActionChip
                icon={Platform.OS === 'ios' ? 'ios-share' : 'share'}
                label={sharing ? 'Sharing…' : 'Share QR'}
                onPress={handleShare}
                styles={styles}
                disabled={sharing || !shareUrl}
              />
              <ActionChip
                icon={copied ? 'check' : 'link'}
                label={copied ? 'Copied' : 'Copy link'}
                onPress={handleCopy}
                styles={styles}
              />
              <ActionChip
                icon="qr-code-scanner"
                label="Scan"
                onPress={() => setMode('scan')}
                styles={styles}
              />
            </View>
          </View>
        ) : (
          <View style={styles.scanPane}>
            {permission === 'checking' ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={theme.colors.accent.primary} />
                <Text style={styles.msg}>Preparing camera…</Text>
              </View>
            ) : permission === 'denied' ? (
              <View style={styles.center}>
                <MaterialIcons name="no-photography" size={42} color={theme.colors.text.muted} />
                <Text style={styles.msg}>
                  Camera permission is required to scan QR codes.
                </Text>
                <Pressable style={styles.settingsBtn} onPress={openAppCameraSettings}>
                  <Text style={styles.settingsTxt}>Open Settings</Text>
                </Pressable>
              </View>
            ) : isFocused && !opening ? (
              <Camera
                style={StyleSheet.absoluteFill}
                cameraType={CameraType.Back}
                scanBarcode
                showFrame
                laserColor={theme.colors.accent.secondary}
                frameColor={theme.colors.accent.primary}
                barcodeFrameSize={{ width: 280, height: 280 }}
                onReadCode={onReadCode}
                torchMode={torchOn ? 'on' : 'off'}
                scanThrottleDelay={500}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.root} />
            )}

            {opening ? (
              <View style={styles.openingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.openingTxt}>Opening profile…</Text>
              </View>
            ) : (
              <View style={[styles.scanHint, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                <Text style={styles.hintTxt}>
                  Point at a Connectiqo creator QR to open their profile
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

function ActionChip({ icon, label, onPress, styles, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        pressed && styles.chipPressed,
        disabled && styles.chipDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.chipIcon}>
        <MaterialIcons name={icon} size={22} color="#fff" />
      </View>
      <Text style={styles.chipLabel}>{label}</Text>
    </Pressable>
  );
}

function createStyles(theme) {
  const C = theme.colors;
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: '#0a0a12',
    },
    topBar: {
      zIndex: 3,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      marginBottom: 4,
    },
    topTitle: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '800',
    },
    circleBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    circleBtnPlaceholder: {
      width: 40,
      height: 40,
    },
    body: {
      flex: 1,
    },
    codePane: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    card: {
      backgroundColor: '#ffffff',
      borderRadius: 28,
      paddingTop: 24,
      paddingBottom: 22,
      paddingHorizontal: 18,
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 12 },
        },
        android: { elevation: 10 },
      }),
    },
    qrBox: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffffff',
      position: 'relative',
    },
    qrFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    qrFallbackTxt: {
      color: '#888',
      fontSize: 12,
      fontWeight: '600',
    },
    cardName: {
      marginTop: 16,
      color: '#111',
      fontSize: 18,
      fontWeight: '800',
      textAlign: 'center',
    },
    cardHandle: {
      marginTop: 4,
      color: '#666',
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
    linkPill: {
      marginTop: 14,
      maxWidth: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: '#f3f3f5',
    },
    linkPillTxt: {
      flexShrink: 1,
      color: '#444',
      fontSize: 11,
      fontWeight: '600',
    },
    hint: {
      marginTop: 18,
      color: 'rgba(255,255,255,0.55)',
      fontSize: 13,
      fontWeight: '500',
      textAlign: 'center',
      paddingHorizontal: 12,
      lineHeight: 18,
    },
    actionsRow: {
      marginTop: 22,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'center',
      gap: 28,
    },
    chip: {
      alignItems: 'center',
      width: 88,
      gap: 8,
    },
    chipPressed: {
      opacity: 0.75,
    },
    chipDisabled: {
      opacity: 0.4,
    },
    chipIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.18)',
    },
    chipLabel: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
    },
    scanPane: {
      flex: 1,
      backgroundColor: '#000',
      overflow: 'hidden',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      gap: 14,
      backgroundColor: C.primary.void,
    },
    msg: {
      color: C.text.secondary,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    settingsBtn: {
      marginTop: 4,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: C.accent.primary,
    },
    settingsTxt: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '700',
    },
    scanHint: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 16,
    },
    hintTxt: {
      color: 'rgba(255,255,255,0.85)',
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
    },
    openingOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.55)',
      gap: 12,
    },
    openingTxt: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '700',
    },
  });
}
