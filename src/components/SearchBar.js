import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { UNIFIED_THEME } from '../unifiedTheme';
import { scaleUi } from '../utils/iosUiScale';

const T = UNIFIED_THEME;

export const SearchBar = ({
  value,
  onChangeText,
  placeholder = 'Search mentors...',
  containerStyle,
  onSubmitEditing,
  autoFocus,
  editable = true,
}) => {
  const [focused, setFocused] = useState(false);
  const text = value ?? '';

  return (
    <View style={[styles.wrapper, focused && styles.wrapperFocused, containerStyle]}>
      <MaterialIcons
        name="search"
        size={scaleUi(20)}
        color={focused ? '#A78BFA' : '#8888a8'}
        style={styles.icon}
      />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#666680"
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
        selectionColor="#7C3AED"
      />
      {text.length > 0 && (
        <TouchableOpacity
          onPress={() => onChangeText('')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.clearBtn}
        >
          <MaterialIcons name="cancel" size={scaleUi(18)} color="#666680" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: scaleUi(14),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: scaleUi(14),
    height: scaleUi(52),
    ...Platform.select({
      android: { elevation: 0 },
    }),
  },
  wrapperFocused: {
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderColor: 'rgba(124,58,237,0.5)',
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
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
