import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { ROBOTO_FONTS } from '../../../styles/fonts';
import { useTheme, useThemedStyles } from '../../../hooks/useTheme';

export default function ChatMessagePopup({
  visible,
  senderName,
  message,
  onPress,
  onDismiss,
}) {
  const styles = useThemedStyles(createPopupStyles);
  const { theme } = useTheme();
  const accent = theme.colors.buttons.nebulaGradient[0];

  if (!visible) return null;

  const preview =
    message?.length > 80 ? `${message.slice(0, 80).trim()}…` : message;

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.banner}
        activeOpacity={0.92}
        onPress={onPress}
      >
        <View style={styles.iconWrap}>
          <MaterialIcons name="chat-bubble" size={18} color={accent} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.sender} numberOfLines={1}>
            {senderName}
          </Text>
          <Text style={styles.message} numberOfLines={2}>
            {preview}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="close" size={18} color={theme.colors.text.muted} />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
}

function createPopupStyles(theme) {
  const C = theme.colors;
  const isLight = theme.mode === 'light';
  return StyleSheet.create({
    wrapper: {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: 88,
      zIndex: 50,
    },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isLight ? C.surface.panel : 'rgba(22, 20, 50, 0.94)',
      borderWidth: 1,
      borderColor: C.border.light,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isLight ? 0.12 : 0.25,
      shadowRadius: 8,
      elevation: 8,
    },
    iconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: C.surface.accentViolet,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    textWrap: {
      flex: 1,
      minWidth: 0,
    },
    sender: {
      color: C.buttons.nebulaGradient[0],
      fontSize: 12,
      fontFamily: ROBOTO_FONTS.RobotoBold,
      marginBottom: 2,
    },
    message: {
      color: C.text.primary,
      fontSize: 14,
      fontFamily: ROBOTO_FONTS.Roboto,
      lineHeight: 18,
    },
    closeBtn: {
      marginLeft: 8,
      padding: 4,
    },
  });
}
