import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-simple-toast';
import CosmicBackground from '../../components/CosmicBackground';
import CosmicButton from '../../components/CosmicButton';
import { UNIFIED_THEME } from '../../unifiedTheme';
import { authApi } from '../../api/authApi';
import { SCREEN_NAMES } from '../../navigators/screenNames';

const T = UNIFIED_THEME;
const C = T.colors;
const B = C.buttons;

import { AUTH_FORM_STYLES } from '../../utils/authFormStyles';

const PURPLE_LINK = B.nebulaGradient[0];
const GOLD = C.accent.primary;

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleEmailChange = (text) => {
    setEmail(text);
    if (loginError) setLoginError('');
  };

  const handlePasswordChange = (text) => {
    setPassword(text);
    if (loginError) setLoginError('');
  };

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setLoginError('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setLoginError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setLoginError('Please enter your password.');
      return;
    }

    setLoginError('');
    setLoading(true);
    try {
      await authApi.signIn({ email: trimmedEmail, password });
      Toast.show('Signed in successfully!');
    } catch (error) {
      console.warn('Login failed:', error?.message);
      setLoginError(error?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CosmicBackground style={styles.background}>
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <MaterialIcons name="videocam" size={40} color={GOLD} style={styles.logoIcon} />
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>
          </View>

          <View style={styles.formContainer}>
            {!!loginError && (
              <View style={styles.errorBanner}>
                <MaterialIcons name="error-outline" size={18} color="#ef4444" style={styles.errorIcon} />
                <Text style={styles.errorText}>{loginError}</Text>
                <TouchableOpacity onPress={() => setLoginError('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MaterialIcons name="close" size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.inputWrapper}>
              <MaterialIcons name="email" size={20} color={C.text.secondary} style={styles.inputIcon} />
              <TextInput
                placeholder="Email Address"
                placeholderTextColor={C.text.muted}
                style={styles.input}
                value={email}
                onChangeText={handleEmailChange}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
                cursorColor="#ffffff"
                selectionColor={PURPLE_LINK}
                selectionHandleColor="transparent"
                underlineColorAndroid="transparent"
              />
            </View>

            <View style={styles.inputWrapper}>
              <MaterialIcons name="lock" size={20} color={C.text.secondary} style={styles.inputIcon} />
              <TextInput
                placeholder="Password"
                placeholderTextColor={C.text.muted}
                style={styles.input}
                value={password}
                onChangeText={handlePasswordChange}
                secureTextEntry={!showPassword}
                editable={!loading}
                cursorColor="#ffffff"
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

            <TouchableOpacity
              onPress={() => navigation.navigate(SCREEN_NAMES.ForgotPassword)}
              disabled={loading}
              style={styles.forgotWrap}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            <CosmicButton
              label={loading ? 'Signing in…' : 'Sign In'}
              variant="nebula"
              onPress={handleLogin}
              disabled={loading}
              loading={loading}
              style={styles.loginBtn}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Signup_Screen')}
              disabled={loading}
            >
              <Text style={styles.signupLink}>Create one</Text>
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
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
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
  formContainer: {
    marginBottom: T.spacing.xxxl,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: T.spacing.md,
    gap: 8,
  },
  errorIcon: {
    flexShrink: 0,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#ef4444',
    lineHeight: 18,
    fontWeight: '500',
  },
  inputWrapper: AUTH_FORM_STYLES.inputWrapper,
  inputIcon: AUTH_FORM_STYLES.inputIcon,
  input: AUTH_FORM_STYLES.input,
  eyeIcon: AUTH_FORM_STYLES.eyeIcon,
  forgotWrap: {
    alignSelf: 'flex-end',
    marginBottom: T.spacing.lg,
    marginTop: T.spacing.sm,
  },
  forgotText: {
    ...T.typography.bodySm,
    color: GOLD,
    fontWeight: '600',
  },
  loginBtn: {
    marginTop: T.spacing.lg,
    ...AUTH_FORM_STYLES.fullWidthButton,
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
  signupLink: {
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
