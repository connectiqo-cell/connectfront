import { useState, useContext } from 'react';
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
import { AuthContext } from '../../contexts/AuthContext';
import { createFormFieldStyles } from '../../utils/platformLayout';

const T = UNIFIED_THEME;
const FORM = createFormFieldStyles({
  chipBg: T.colors.component.input,
  borderColor: T.colors.border.light,
  textColor: T.colors.text.primary,
});

// ── Step indicators ────────────────────────────────────────────────────────────
function StepDots({ current }) {
  return (
    <View style={styles.dots}>
      {[1, 2, 3].map(n => (
        <View
          key={n}
          style={[
            styles.dot,
            current === n && styles.dotActive,
            current > n && styles.dotDone,
          ]}
        >
          {current > n ? (
            <MaterialIcons name="check" size={10} color="#fff" />
          ) : null}
        </View>
      ))}
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

export default function ForgotPasswordScreen({ navigation }) {
  const { setPendingPasswordReset, signOut } = useContext(AuthContext);
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Step 1: send OTP ───────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }
    setLoading(true);
    try {
      await authApi.sendPasswordResetOtp(email);
      setStep(2);
    } catch (error) {
      Alert.alert('Error', error.message || 'Could not send code. Please check your email.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: verify OTP ─────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otp.trim().length < 4) {
      Alert.alert('Error', 'Please enter the full code from your email');
      return;
    }
    setLoading(true);
    try {
      // Block RootNavigator from switching to main app when session is created
      setPendingPasswordReset(true);
      await authApi.verifyOtp(email, otp);
      setStep(3);
    } catch (error) {
      setPendingPasswordReset(false);
      Alert.alert(
        'Invalid Code',
        error.message || 'The code is incorrect or has expired.',
        [
          { text: 'Try Again', style: 'cancel' },
          { text: 'Resend Code', onPress: handleSendOtp },
        ],
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: set new password ───────────────────────────────────────────────
  const handleSavePassword = async () => {
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
      await authApi.updatePassword(password);
      // Sign out so user logs in fresh with new password
      await signOut();
      // Clear flag — RootNavigator now shows auth screens
      setPendingPasswordReset(false);
      Alert.alert(
        'Password Updated',
        'Your password has been saved. Please log in with your new password.',
        [{ text: 'OK', onPress: () => navigation.navigate(SCREEN_NAMES.Login) }],
      );
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to save password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Shared back behaviour ──────────────────────────────────────────────────
  const handleBack = () => {
    if (step > 1) setStep(s => s - 1);
    else navigation.goBack();
  };

  // ── Step meta ──────────────────────────────────────────────────────────────
  const meta = {
    1: {
      icon: 'lock-reset',
      title: 'Forgot Password?',
      subtitle: 'Enter your registered email and we\'ll send a 6-digit verification code.',
    },
    2: {
      icon: 'mark-email-read',
      title: 'Enter Code',
      subtitle: `A verification code was sent to\n${email}`,
    },
    3: {
      icon: 'lock',
      title: 'New Password',
      subtitle: 'Choose a strong password for your account.',
    },
  }[step];

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
          {/* Back button */}
          <TouchableOpacity
            onPress={handleBack}
            style={[styles.backBtn, { top: T.spacing.sm }]}
          >
            <MaterialIcons name="arrow-back" size={22} color={T.colors.text.primary} />
          </TouchableOpacity>

          {/* Step dots */}
          <StepDots current={step} />

          {/* Icon + heading */}
          <View style={styles.iconWrap}>
            <MaterialIcons name={meta.icon} size={48} color={T.colors.accent.primary} />
          </View>
          <Text style={styles.title}>{meta.title}</Text>
          <Text style={styles.subtitle}>{meta.subtitle}</Text>

          {/* ── Step 1: Email ─────────────────────────────────────────────── */}
          {step === 1 && (
            <>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="email" size={20} color={T.colors.text.secondary} style={styles.inputIcon} />
                <TextInput
                  placeholder="Email Address"
                  placeholderTextColor={T.colors.text.secondary}
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                  cursorColor={T.colors.accent.secondary}
                  selectionColor={T.colors.accent.secondary}
                />
              </View>
              <Button
                text={loading ? 'Sending Code...' : 'Send Code'}
                variant="primary"
                onPress={handleSendOtp}
                disabled={loading}
                loading={loading}
                style={styles.btn}
              />
            </>
          )}

          {/* ── Step 2: OTP ───────────────────────────────────────────────── */}
          {step === 2 && (
            <>
              <View style={[styles.inputWrapper, styles.otpWrapper]}>
                <TextInput
                  placeholder="Enter code"
                  placeholderTextColor={T.colors.text.muted}
                  style={[styles.input, styles.otpInput]}
                  value={otp}
                  onChangeText={v => setOtp(v.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  editable={!loading}
                  cursorColor={T.colors.accent.secondary}
                  selectionColor={T.colors.accent.secondary}
                />
              </View>

              <Button
                text={loading ? 'Verifying...' : 'Verify Code'}
                variant="primary"
                onPress={handleVerifyOtp}
                disabled={loading}
                loading={loading}
                style={styles.btn}
              />

              <TouchableOpacity onPress={handleSendOtp} disabled={loading} style={styles.resendWrap}>
                <Text style={styles.resendTxt}>Didn't receive a code? </Text>
                <Text style={styles.resendLink}>Resend</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Step 3: New password ──────────────────────────────────────── */}
          {step === 3 && (
            <>
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

              {(() => {
                const hasConfirm = confirmPassword.length > 0;
                const matches = password === confirmPassword && hasConfirm;
                const mismatch = hasConfirm && password !== confirmPassword;
                return (
                  <>
                    <View style={[
                      styles.inputWrapper,
                      matches && styles.inputMatch,
                      mismatch && styles.inputMismatch,
                    ]}>
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
                      {matches && (
                        <MaterialIcons name="check-circle" size={20} color={T.colors.accent.success} />
                      )}
                      {mismatch && (
                        <MaterialIcons name="cancel" size={20} color={T.colors.accent.error || '#ef4444'} />
                      )}
                    </View>
                    {mismatch && (
                      <Text style={styles.matchHint}>Passwords do not match</Text>
                    )}
                    {matches && (
                      <Text style={[styles.matchHint, styles.matchHintOk]}>Passwords match</Text>
                    )}
                  </>
                );
              })()}

              <Button
                text={loading ? 'Saving...' : 'Save Password'}
                variant="primary"
                onPress={handleSavePassword}
                disabled={loading || password !== confirmPassword || password.length < 6}
                loading={loading}
                style={styles.btn}
              />
            </>
          )}

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
    paddingTop: T.spacing.xxxl,
  },
  backBtn: {
    position: 'absolute',
    left: 0,
    padding: T.spacing.sm,
    zIndex: 2,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: T.spacing.xl,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: T.colors.border.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotActive: {
    width: 28,
    borderRadius: 5,
    backgroundColor: T.colors.accent.primary,
  },
  dotDone: {
    backgroundColor: T.colors.accent.success,
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
  inputWrapper: FORM.inputWrapper,
  otpWrapper: {
    justifyContent: 'center',
    borderColor: T.colors.accent.primary,
    borderWidth: 1.5,
  },
  inputIcon: FORM.inputIcon,
  input: FORM.input,
  otpInput: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 10,
  },
  eyeIcon: FORM.eyeIcon,
  inputMatch: { borderColor: T.colors.accent.success, borderWidth: 1.5 },
  inputMismatch: { borderColor: '#ef4444', borderWidth: 1.5 },
  matchHint: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: -T.spacing.sm,
    marginBottom: T.spacing.sm,
    marginLeft: T.spacing.xs,
  },
  matchHintOk: { color: T.colors.accent.success },
  btn: { marginTop: T.spacing.sm, ...FORM.fullWidthButton },
  resendWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: T.spacing.xl,
  },
  resendTxt: { ...T.typography.bodySm, color: T.colors.text.secondary },
  resendLink: { ...T.typography.bodySm, color: T.colors.accent.primary, fontWeight: '600' },
});
