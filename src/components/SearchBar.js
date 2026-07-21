import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme, useThemedStyles } from '../hooks/useTheme';
import { scaleUi } from '../utils/iosUiScale';

export const SearchBar = ({
  value,
  onChangeText,
  placeholder = 'Search mentors...',
  containerStyle,
  onSubmitEditing,
  autoFocus,
  editable = true,
}) => {
  const { theme, isDark } = useTheme();
  const styles = useThemedStyles(createSearchStyles);
  const C = theme.colors;
  const [focused, setFocused] = useState(false);
  const text = value ?? '';

  const iconColor = focused
    ? C.accent.primary
    : C.text.muted;
  const placeholderColor = C.text.muted;
  const clearColor = C.text.muted;

  return (
    <View
      style={[
        styles.wrapper,
        focused && styles.wrapperFocused,
        containerStyle,
      ]}
    >
      <MaterialIcons
        name="search"
        size={scaleUi(20)}
        color={iconColor}
        style={styles.icon}
      />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        value={text}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        returnKeyType="search"
        onSubmitEditing={onSubmitEditing}
        autoCorrect={false}
        autoCapitalize="none"
        autoFocus={autoFocus}
        editable={editable}
        underlineColorAndroid="transparent"
        selectionColor={C.accent.primary}
        keyboardAppearance={isDark ? 'dark' : 'light'}
      />
      {text.length > 0 && (
        <TouchableOpacity
          onPress={() => onChangeText('')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.clearBtn}
        >
          <MaterialIcons name="cancel" size={scaleUi(18)} color={clearColor} />
        </TouchableOpacity>
      )}
    </View>
  );
};

function createSearchStyles(theme) {
  const C = theme.colors;
  const isLight = theme.mode === 'light';

  return StyleSheet.create({
    wrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isLight ? C.surface.panel : 'rgba(255,255,255,0.07)',
      borderRadius: scaleUi(14),
      borderWidth: 1,
      borderColor: isLight ? C.border.light : 'rgba(255,255,255,0.1)',
      paddingHorizontal: scaleUi(14),
      height: scaleUi(52),
      ...Platform.select({
        android: { elevation: 0 },
        ios: isLight
          ? {
              shadowColor: C.text.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
            }
          : {},
      }),
    },
    wrapperFocused: {
      backgroundColor: isLight ? C.surface.chip : 'rgba(124,58,237,0.1)',
      borderColor: C.border.strong,
    },
    icon: {
      marginRight: 10,
    },
    input: {
      flex: 1,
      color: C.text.primary,
      fontSize: scaleUi(14),
      fontWeight: '400',
      backgroundColor: 'transparent',
      paddingVertical: 0,
      margin: 0,
      includeFontPadding: false,
      ...(Platform.OS === 'android' ? { textAlignVertical: 'center' } : {}),
    },
    clearBtn: {
      marginLeft: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
}
