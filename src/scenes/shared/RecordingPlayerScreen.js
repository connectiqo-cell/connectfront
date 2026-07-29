import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Video from 'react-native-video';
import { UNIFIED_THEME } from '../../unifiedTheme';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { normalizeRecordingUrl } from '../../api/api';
import { CONTENT_VIDEO_AUDIO_PROPS } from '../../utils/videoPlayback';

const TEAL = UNIFIED_THEME.colors.accent.secondary;

export default function RecordingPlayerScreen({ navigation, route }) {
  const styles = useThemedStyles(createRecordingPlayerStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const sourceUrl = useMemo(() => {
    const rawUrl = route?.params?.recordingUrl;
    return normalizeRecordingUrl(rawUrl);
  }, [route?.params?.recordingUrl]);

  const handleRetry = useCallback(() => {
    setError(false);
    setLoading(true);
    setRetryKey(k => k + 1);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {!sourceUrl ? (
        <View style={styles.centered}>
          <MaterialIcons name="link-off" size={40} color="#888" />
          <Text style={styles.message}>Recording unavailable</Text>
        </View>
      ) : error ? (
        <TouchableOpacity style={styles.centered} onPress={handleRetry} activeOpacity={0.8}>
          <MaterialIcons name="refresh" size={40} color="#888" />
          <Text style={styles.message}>Tap to retry</Text>
        </TouchableOpacity>
      ) : (
        <>
          {loading ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={TEAL} />
            </View>
          ) : null}
          <Video
            key={`${sourceUrl}-${retryKey}`}
            source={{ uri: sourceUrl }}
            style={styles.video}
            controls
            resizeMode="cover"
            paused={true}
            onLoadStart={() => {
              setLoading(true);
              setError(false);
            }}
            onLoad={() => setLoading(false)}
            onError={e => {
              console.warn('Recording player error:', e);
              setLoading(false);
              setError(true);
            }}
            {...CONTENT_VIDEO_AUDIO_PROPS}
          />
        </>
      )}

      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + 8 }]}
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <MaterialIcons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

function createRecordingPlayerStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  const isLight = T.mode === 'light';
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    zIndex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  message: {
    color: '#aaa',
    fontSize: 15,
    textAlign: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: 12,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
}