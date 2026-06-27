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
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { authApi } from '../../api/authApi';
import { profileApi } from '../../api/profileApi';
import { AUTH_FORM_STYLES } from '../../utils/authFormStyles';

const T = UNIFIED_THEME;
const C = T.colors;
const B = C.buttons;
const S = C.surface;

const PURPLE_LINK = B.nebulaGradient[0];
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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const clearError = field => errors[field] && setErrors(prev => ({ ...prev, [field]: null }));

  const handleSignup = async () => {
    const e = validateFields({ name, email, password, confirmPassword });
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    setErrors({});

    setLoading(true);
    try {
      const { user } = await authApi.signUp({
        email: email.trim(),
        password,
        name: name.trim(),
        role: 'both',
      });

      if (user?.id) {
        await Promise.all([
          profileApi.createMentorProfile(user.id),
          profileApi.createLearnerProfile(user.id),
        ]);
      }

      Toast.show('Account created! Please sign in.');
      navigation.navigate('Login_Screen');
    } catch (error) {
      Toast.show(error.message);
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
            <Text style={styles.title}>Create Account</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={[styles.inputWrapper, errors.name && styles.inputError]}>
              <MaterialIcons name="person" size={20} color={C.text.secondary} style={styles.inputIcon} />
              <TextInput
                placeholder="Full Name"
                placeholderTextColor={C.text.muted}
                style={styles.input}
                value={name}
                onChangeText={v => { setName(v); clearError('name'); }}
                editable={!loading}
                cursorColor="#ffffff"
                selectionColor={PURPLE_LINK}
                selectionHandleColor="transparent"
                underlineColorAndroid="transparent"
              />
            </View>
            {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}

            <View style={[styles.inputWrapper, errors.email && styles.inputError]}>
              <MaterialIcons name="email" size={20} color={C.text.secondary} style={styles.inputIcon} />
              <TextInput
                placeholder="Email Address"
                placeholderTextColor={C.text.muted}
                style={styles.input}
                value={email}
                onChangeText={v => { setEmail(v); clearError('email'); }}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
                cursorColor="#ffffff"
                selectionColor={PURPLE_LINK}
                selectionHandleColor="transparent"
                underlineColorAndroid="transparent"
              />
            </View>
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

            <View style={[styles.inputWrapper, errors.password && styles.inputError]}>
              <MaterialIcons name="lock" size={20} color={C.text.secondary} style={styles.inputIcon} />
              <TextInput
                placeholder="Password"
                placeholderTextColor={C.text.muted}
                style={styles.input}
                value={password}
                onChangeText={v => { setPassword(v); clearError('password'); }}
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
            {errors.password
              ? <Text style={styles.errorText}>{errors.password}</Text>
              : <Text style={styles.hintText}>Min 8 chars, one uppercase, one number</Text>}

            <View style={[styles.inputWrapper, errors.confirmPassword && styles.inputError]}>
              <MaterialIcons name="lock-outline" size={20} color={C.text.secondary} style={styles.inputIcon} />
              <TextInput
                placeholder="Confirm Password"
                placeholderTextColor={C.text.muted}
                style={styles.input}
                value={confirmPassword}
                onChangeText={v => { setConfirmPassword(v); clearError('confirmPassword'); }}
                secureTextEntry={!showConfirmPassword}
                editable={!loading}
                cursorColor="#ffffff"
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

            <CosmicButton
              label="Create Account"
              variant="nebula"
              onPress={handleSignup}
              disabled={loading}
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
  title: {
    ...T.typography.headingLg,
    color: C.text.primary,
    textAlign: 'center',
    fontWeight: '800',
    marginBottom: T.spacing.sm,
  },
  formContainer: {
    marginBottom: T.spacing.xxxl,
  },
  inputWrapper: AUTH_FORM_STYLES.inputWrapper,
  inputIcon: AUTH_FORM_STYLES.inputIcon,
  input: AUTH_FORM_STYLES.input,
  eyeIcon: AUTH_FORM_STYLES.eyeIcon,
  inputError: AUTH_FORM_STYLES.inputError,
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
