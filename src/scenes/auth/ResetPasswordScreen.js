import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import CosmicBackground from '../../components/CosmicBackground';
import { UNIFIED_THEME } from '../../unifiedTheme';
import Button from '../../components/Button';
import { authApi } from '../../api/authApi';
import { SCREEN_NAMES } from '../../navigators/screenNames';
import { createFormFieldStyles } from '../../utils/platformLayout';

const T = UNIFIED_THEME;
const FORM = createFormFieldStyles({
  chipBg: T.colors.component.input,
  borderColor: T.colors.border.light,
  textColor: T.colors.text.primary,
});

export default function ResetPasswordScreen({ route, navigation }) {
  const { email } = route.params;
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (otp.trim().length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit code from your email');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await authApi.verifyOtpAndSetPassword(email, otp, password);
      Alert.alert(
        'Success',
        'Your password has been reset. Please log in with your new password.',
        [{ text: 'Go to Login', onPress: () => navigation.navigate(SCREEN_NAMES.Login) }],
      );
    } catch (error) {
      Alert.alert('Error', error.message || 'Invalid code or something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CosmicBackground style={styles.background}>
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.container}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <MaterialIcons name="arrow-back" size={22} color={T.colors.text.primary} />
              </TouchableOpacity>

              <View style={styles.iconWrap}>
                <MaterialIcons name="verified-user" size={48} color={T.colors.accent.primary} />
              </View>

              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.subtitle}>
                Enter the 6-digit code sent to{'\n'}
                <Text style={styles.emailHighlight}>{email}</Text>
              </Text>

              <View style={styles.inputWrapper}>
                <MaterialIcons name="pin" size={20} color={T.colors.text.secondary} style={styles.inputIcon} />
                <TextInput
                  placeholder="6-digit code"
                  placeholderTextColor={T.colors.text.secondary}
                  style={[styles.input, styles.otpInput]}
                  value={otp}
                  onChangeText={v => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  editable={!loading}
                  cursorColor={T.colors.accent.secondary}
                  selectionColor={T.colors.accent.secondary}
                  maxLength={6}
                />
              </View>

              <View style={styles.inputWrapper}>
                <MaterialIcons name="lock" size={20} color={T.colors.text.secondary} style={styles.inputIcon} />
                <TextInput
                  placeholder="New Password"
                  placeholderTextColor={T.colors.text.secondary}
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  cursorColor={T.colors.accent.secondary}
                  selectionColor={T.colors.accent.secondary}
                />
                <TouchableOpacity onPress={() => setShowPassword(p => !p)} style={styles.eyeIcon}>
                  <MaterialIcons
                    name={showPassword ? 'visibility' : 'visibility-off'}
                    size={20}
                    color={T.colors.text.secondary}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.inputWrapper}>
                <MaterialIcons name="lock-outline" size={20} color={T.colors.text.secondary} style={styles.inputIcon} />
                <TextInput
                  placeholder="Confirm New Password"
                  placeholderTextColor={T.colors.text.secondary}
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  cursorColor={T.colors.accent.secondary}
                  selectionColor={T.colors.accent.secondary}
                />
              </View>

              <Button
                text={loading ? 'Resetting...' : 'Reset Password'}
                variant="primary"
                onPress={handleReset}
                disabled={loading}
                loading={loading}
                style={styles.btn}
              />

              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.resendWrap}>
                <Text style={styles.resendTxt}>Didn't receive a code? </Text>
                <Text style={styles.resendLink}>Go back to resend</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: T.spacing.lg,
    paddingBottom: T.spacing.xl,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: T.spacing.lg,
  },
  backBtn: {
    alignSelf: 'flex-start',
    padding: T.spacing.sm,
    marginBottom: T.spacing.md,
  },
  iconWrap: { alignItems: 'center', marginBottom: T.spacing.lg },
  title: {
    ...T.typography.headingLg,
    color: T.colors.text.primary,
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: T.spacing.sm,
  },
  subtitle: {
    ...T.typography.bodySm,
    color: T.colors.text.secondary,
    textAlign: 'center',
    marginBottom: T.spacing.xxxl,
    lineHeight: 20,
  },
  emailHighlight: { color: T.colors.accent.primary, fontWeight: '600' },
  inputWrapper: FORM.inputWrapper,
  inputIcon: FORM.inputIcon,
  input: FORM.input,
  otpInput: { letterSpacing: 4, fontWeight: '700', fontSize: 18 },
  eyeIcon: FORM.eyeIcon,
  btn: { marginTop: T.spacing.sm, ...FORM.fullWidthButton },
  resendWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: T.spacing.xl,
  },
  resendTxt: { ...T.typography.bodySm, color: T.colors.text.secondary },
  resendLink: { ...T.typography.bodySm, color: T.colors.accent.primary, fontWeight: '600' },
});
