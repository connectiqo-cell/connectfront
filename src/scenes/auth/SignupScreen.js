import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-simple-toast';
import CosmicBackground from '../../components/CosmicBackground';
import CosmicButton from '../../components/CosmicButton';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { createAuthFormStyles } from '../../utils/authFormStyles';
import { authApi } from '../../api/authApi';
import { profileApi } from '../../api/profileApi';
import { getBrandLogo } from '../../utils/brandLogo';
import { PRIVACY_URL, TERMS_URL } from '../../constants/legal';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateFields({ name, email, password, confirmPassword }) {
  const e = {};
  if (!name.trim()) {
    e.name = 'Name is required';
  }
  if (!email.trim()) {
    e.email = 'Email is required';
  } else if (!EMAIL_REGEX.test(email.trim().toLowerCase())) {
    e.email = 'Enter a valid email address';
  }
  if (password.length < 8) {
    e.password = 'Must be at least 8 characters';
  } else if (!/[A-Z]/.test(password)) {
    e.password = 'Must contain at least one uppercase letter';
  } else if (!/[0-9]/.test(password)) {
    e.password = 'Must contain at least one number';
  }
  if (!e.password && password !== confirmPassword) {
    e.confirmPassword = 'Passwords do not match';
  }
  return e;
}

export default function SignupScreen({ navigation }) {
  const styles = useThemedStyles(createThemedStyles);
  const { theme, isDark } = useTheme();
  const C = theme.colors;
  const PURPLE_LINK = C.buttons.nebulaGradient[0];
  const cursorColor = theme.mode === 'light' ? C.text.primary : '#ffffff';
  const brandLogo = getBrandLogo(isDark);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Set once signUp() comes back with no session — i.e. email confirmation is
  // required (same flow as the web portal). If confirmation is disabled,
  // signUp() returns a session immediately and this step is skipped.
  const [step, setStep] = useState('form');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const clearError = field => errors[field] && setErrors(prev => ({ ...prev, [field]: null }));

  // profiles row requires auth.uid() = id under RLS, so this only runs once a
  // session exists. The session also flips RootNavigator to the authed stack,
  // which sends new users (no interests yet) to interests onboarding.
  const finishSignup = async userId => {
    await authApi.createProfile({
      userId,
      email: email.trim(),
      name: name.trim(),
      role: 'both',
    });
    await Promise.all([
      profileApi.createMentorProfile(userId),
      profileApi.createLearnerProfile(userId),
    ]);
  };

  const handleSignup = async () => {
    const e = validateFields({ name, email, password, confirmPassword });
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    if (!acceptedTerms) {
      Toast.show('Please accept the Terms of Use and Privacy Policy to continue.');
      return;
    }
    setErrors({});

    setLoading(true);
    try {
      const { user, needsVerification } = await authApi.signUp({
        email: email.trim(),
        password,
        name: name.trim(),
        role: 'both',
      });
      if (!user?.id) throw new Error('Sign up did not return a user.');

      if (needsVerification) {
        setOtp('');
        setOtpError('');
        setStep('otp');
        return;
      }

      await finishSignup(user.id);
    } catch (error) {
      Toast.show(error.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      setOtpError('Enter the code we sent you');
      return;
    }
    setOtpError('');
    setVerifying(true);
    try {
      const { user } = await authApi.verifySignupOtp(email, otp);
      if (!user?.id) throw new Error('Verification did not return a user.');
      await finishSignup(user.id);
    } catch (error) {
      setOtpError(error.message || 'Invalid or expired code. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    setOtpError('');
    setResending(true);
    try {
      await authApi.resendSignupOtp(email);
      Toast.show('Code resent — check your inbox.');
    } catch (error) {
      setOtpError(error.message || 'Could not resend the code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  if (step === 'otp') {
    return (
      <CosmicBackground style={styles.background}>
        <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Image source={brandLogo} style={styles.logoIcon} resizeMode="contain" />
              <Text style={styles.title}>Verify your email</Text>
              <Text style={styles.subtitle}>
                We sent a 6-digit code to{' '}
                <Text style={styles.subtitleEmail}>{email.trim()}</Text>.
                Enter it below to finish creating your account.
              </Text>
            </View>

            <View style={styles.formContainer}>
              <View style={[styles.inputWrapper, otpError && styles.inputError]}>
                <View style={styles.inputIconSlot}>
                  <MaterialIcons name="lock" size={20} color={C.text.secondary} />
                </View>
                <TextInput
                  placeholder="6-digit code"
                  placeholderTextColor={C.text.muted}
                  style={styles.input}
                  value={otp}
                  onChangeText={v => { setOtp(v.replace(/\D/g, '')); if (otpError) setOtpError(''); }}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  maxLength={6}
                  editable={!verifying}
                  cursorColor={cursorColor}
                  selectionColor={PURPLE_LINK}
                  selectionHandleColor="transparent"
                  underlineColorAndroid="transparent"
                />
              </View>
              {otpError ? <Text style={styles.errorText}>{otpError}</Text> : null}

              <CosmicButton
                label={verifying ? 'Verifying…' : 'Verify & Continue'}
                variant="nebula"
                onPress={handleVerifyOtp}
                disabled={verifying}
                loading={verifying}
                style={styles.signupBtn}
              />
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Didn't get a code?</Text>
              <TouchableOpacity onPress={handleResendOtp} disabled={resending || verifying}>
                <Text style={styles.signinLink}>{resending ? 'Resending…' : 'Resend code'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => setStep('form')}
              disabled={verifying}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>← Wrong email? Go back</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>

        <LoadingOverlay visible={verifying} message="Verifying your email..." />
      </CosmicBackground>
    );
  }

  return (
    <CosmicBackground style={styles.background}>
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Image source={brandLogo} style={styles.logoIcon} resizeMode="contain" />
            <Text style={styles.title}>Create Account</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={[styles.inputWrapper, errors.name && styles.inputError]}>
              <View style={styles.inputIconSlot}>
                <MaterialIcons name="person" size={20} color={C.text.secondary} />
              </View>
              <TextInput
                placeholder="Full Name"
                placeholderTextColor={C.text.muted}
                style={styles.input}
                value={name}
                onChangeText={v => { setName(v); clearError('name'); }}
                editable={!loading}
                autoCorrect
                spellCheck
                autoCapitalize="words"
                cursorColor={cursorColor}
                selectionColor={PURPLE_LINK}
                selectionHandleColor="transparent"
                underlineColorAndroid="transparent"
              />
            </View>
            {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}

            <View style={[styles.inputWrapper, errors.email && styles.inputError]}>
              <View style={styles.inputIconSlot}>
                <MaterialIcons name="email" size={20} color={C.text.secondary} />
              </View>
              <TextInput
                placeholder="Email Address"
                placeholderTextColor={C.text.muted}
                style={styles.input}
                value={email}
                onChangeText={v => { setEmail(v); clearError('email'); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                editable={!loading}
                cursorColor={cursorColor}
                selectionColor={PURPLE_LINK}
                selectionHandleColor="transparent"
                underlineColorAndroid="transparent"
              />
            </View>
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

            <View style={[styles.inputWrapper, errors.password && styles.inputError]}>
              <View style={styles.inputIconSlot}>
                <MaterialIcons name="lock" size={20} color={C.text.secondary} />
              </View>
              <TextInput
                placeholder="Password"
                placeholderTextColor={C.text.muted}
                style={styles.input}
                value={password}
                onChangeText={v => { setPassword(v); clearError('password'); }}
                secureTextEntry={!showPassword}
                autoCorrect={false}
                spellCheck={false}
                editable={!loading}
                cursorColor={cursorColor}
                selectionColor={PURPLE_LINK}
                selectionHandleColor="transparent"
                underlineColorAndroid="transparent"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                disabled={loading}
                style={styles.eyeIcon}
              >
                <MaterialIcons
                  name={showPassword ? 'visibility' : 'visibility-off'}
                  size={20}
                  color={C.text.secondary}
                />
              </TouchableOpacity>
            </View>
            {errors.password
              ? <Text style={styles.errorText}>{errors.password}</Text>
              : <Text style={styles.hintText}>Min 8 chars, one uppercase, one number</Text>}

            <View style={[styles.inputWrapper, errors.confirmPassword && styles.inputError]}>
              <View style={styles.inputIconSlot}>
                <MaterialIcons name="lock-outline" size={20} color={C.text.secondary} />
              </View>
              <TextInput
                placeholder="Confirm Password"
                placeholderTextColor={C.text.muted}
                style={styles.input}
                value={confirmPassword}
                onChangeText={v => { setConfirmPassword(v); clearError('confirmPassword'); }}
                secureTextEntry={!showConfirmPassword}
                autoCorrect={false}
                spellCheck={false}
                editable={!loading}
                cursorColor={cursorColor}
                selectionColor={PURPLE_LINK}
                selectionHandleColor="transparent"
                underlineColorAndroid="transparent"
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={loading}
                style={styles.eyeIcon}
              >
                <MaterialIcons
                  name={showConfirmPassword ? 'visibility' : 'visibility-off'}
                  size={20}
                  color={C.text.secondary}
                />
              </TouchableOpacity>
            </View>
            {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}

            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setAcceptedTerms(v => !v)}
              disabled={loading}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptedTerms }}
              accessibilityLabel="Accept the Terms of Use and Privacy Policy"
            >
              <MaterialIcons
                name={acceptedTerms ? 'check-box' : 'check-box-outline-blank'}
                size={22}
                color={acceptedTerms ? PURPLE_LINK : C.text.secondary}
              />
              <Text style={styles.termsText}>
                I agree to the{' '}
                <Text
                  style={styles.termsLink}
                  onPress={() => Linking.openURL(TERMS_URL)}
                >
                  Terms of Use (EULA)
                </Text>{' '}
                and{' '}
                <Text
                  style={styles.termsLink}
                  onPress={() => Linking.openURL(PRIVACY_URL)}
                >
                  Privacy Policy
                </Text>
                . Objectionable content and abusive behaviour are not tolerated
                and lead to removal.
              </Text>
            </TouchableOpacity>

            <CosmicButton
              label="Create Account"
              variant="nebula"
              onPress={handleSignup}
              disabled={loading || !acceptedTerms}
              loading={loading}
              style={styles.signupBtn}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login_Screen')}
              disabled={loading}
            >
              <Text style={styles.signinLink}>Sign In</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            disabled={loading}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      <LoadingOverlay visible={loading} message="Creating your account..." />
    </CosmicBackground>
  );
}

function createThemedStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const PURPLE_LINK = C.buttons.nebulaGradient[0];
  const form = createAuthFormStyles(theme);

  return StyleSheet.create({
    termsRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginTop: 14,
      marginBottom: 4,
    },
    termsText: {
      flex: 1,
      ...T.typography.bodySm,
      color: C.text.secondary,
      lineHeight: 18,
    },
    termsLink: {
      color: PURPLE_LINK,
      fontWeight: '700',
    },
    background: { flex: 1 },
    overlay: { flex: 1 },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: T.spacing.lg,
      paddingVertical: T.spacing.lg,
    },
    header: {
      alignItems: 'center',
      marginBottom: T.spacing.xxxl,
    },
    logoIcon: {
      width: 72,
      height: 72,
      marginBottom: T.spacing.lg,
    },
    title: {
      ...T.typography.headingLg,
      color: C.text.primary,
      textAlign: 'center',
      fontWeight: '800',
      marginBottom: T.spacing.sm,
    },
    subtitle: {
      ...T.typography.bodySm,
      color: C.text.secondary,
      textAlign: 'center',
    },
    subtitleEmail: {
      color: C.text.primary,
      fontWeight: '600',
    },
    formContainer: {
      marginBottom: T.spacing.xxxl,
    },
    inputWrapper: form.inputWrapper,
    inputIconSlot: form.inputIconSlot,
    input: form.input,
    eyeIcon: form.eyeIcon,
    inputError: form.inputError,
    errorText: {
      ...T.typography.bodyXs,
      color: C.accent.error,
      marginTop: -T.spacing.md,
      marginBottom: T.spacing.md,
      marginLeft: T.spacing.sm,
    },
    hintText: {
      ...T.typography.bodyXs,
      color: C.text.muted,
      marginTop: -T.spacing.md,
      marginBottom: T.spacing.md,
      marginLeft: T.spacing.sm,
    },
    signupBtn: {
      marginTop: T.spacing.lg,
      ...form.fullWidthButton,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: T.spacing.xl,
      gap: T.spacing.sm,
    },
    footerText: {
      ...T.typography.bodySm,
      color: C.text.secondary,
    },
    signinLink: {
      ...T.typography.bodySm,
      color: PURPLE_LINK,
      fontWeight: '600',
    },
    backButton: {
      alignSelf: 'center',
      paddingVertical: T.spacing.md,
    },
    backButtonText: {
      ...T.typography.bodySm,
      color: PURPLE_LINK,
      fontWeight: '600',
    },
  });
}
