import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ImageBackground,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { colors, typography } from '@/constants/designSystem';
import { getPostAuthHref, isPatientFacingRole } from '@/lib/authRouting';
import { useAuth } from '@/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAppTheme } from '@/lib/theme/ThemeProvider';
import { useAuthStore } from '@/stores/authStore';

const BIOMETRIC_PREF_KEY = 'sonalife_biometric_enabled';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tokens } = useAppTheme();
  const styles = createStyles(tokens);
  const { signIn, requestPasswordReset } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const offerBiometricEnrollment = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) return;
    const existing = await SecureStore.getItemAsync(BIOMETRIC_PREF_KEY);
    if (existing === '1') return;
    Alert.alert('Sign in faster next time?', 'Use Face ID or Touch ID to unlock the app.', [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Enable',
        onPress: () => void SecureStore.setItemAsync(BIOMETRIC_PREF_KEY, '1'),
      },
    ]);
  };

  const navigateAfterAuth = () => {
    const profile = useAuthStore.getState().profile;
    const patientOnboardingComplete = useAuthStore.getState().patientOnboardingComplete;
    const superAdminViewMode = useAuthStore.getState().superAdminViewMode;
    if (!profile) {
      router.replace('/(auth)/account-recovery');
      return;
    }
    const onboardingComplete =
      !isPatientFacingRole(profile.role) || patientOnboardingComplete === true;
    router.replace(getPostAuthHref(profile, onboardingComplete, superAdminViewMode));
  };

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setSubmitting(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        Alert.alert('Sign in failed', error.message);
        return;
      }
      await offerBiometricEnrollment();
      navigateAfterAuth();
    } finally {
      setSubmitting(false);
    }
  });

  const onForgotPassword = () => {
    const email = getValues('email').trim();
    if (!email) {
      Alert.alert('Email needed', 'Enter your email above, then tap Forgot password again.');
      return;
    }
    void (async () => {
      const { error } = await requestPasswordReset(email);
      if (error) {
        Alert.alert('Reset failed', error.message);
        return;
      }
      Alert.alert('Check your email', 'We sent a link to reset your password.');
    })();
  };

  const ph = tokens.colors.textCaption;

  return (
    <ImageBackground source={require('@/assets/images/sonalife-splash.png')} style={styles.screen} resizeMode="cover">
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={[
            styles.content,
            {
              paddingTop: insets.top + 32,
              paddingBottom: Math.max(insets.bottom, 16) + 16,
            },
          ]}>
          <View style={styles.topBlock}>
            <View style={styles.hero}>
              <Text style={styles.wordmark}>KENOVUS</Text>
              <Text style={styles.tagline}>Sign in to SonaLife</Text>
              {!isSupabaseConfigured ? (
                <Text style={styles.envWarn}>
                  Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and
                  EXPO_PUBLIC_SUPABASE_ANON_KEY to .env, then restart with npx expo start -c
                </Text>
              ) : null}
            </View>

            <View style={styles.formBlock}>
            <Text style={styles.label}>Email</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.inputContainer}>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    keyboardType="email-address"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="you@example.com"
                    placeholderTextColor={ph}
                    style={styles.input}
                    value={value}
                  />
                </View>
              )}
            />
            {errors.email ? <Text style={styles.error}>{errors.email.message}</Text> : null}

            <Text style={[styles.label, styles.labelSpaced]}>Password</Text>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.inputContainer}>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="password"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="••••••••"
                    placeholderTextColor={ph}
                    secureTextEntry
                    style={styles.input}
                    value={value}
                  />
                </View>
              )}
            />
            {errors.password ? <Text style={styles.error}>{errors.password.message}</Text> : null}

            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={onSubmit}
              style={[styles.submit, submitting && styles.submitDisabled]}>
              {submitting ? (
                <ActivityIndicator color={tokens.colors.accent} />
              ) : (
                <Text style={styles.submitLabel}>Continue</Text>
              )}
            </Pressable>

            <Text onPress={onForgotPassword} style={styles.forgot}>
              Forgot password
            </Text>
          </View>

            <Text style={styles.registerRow}>
              New here?{' '}
              <Link href="/(auth)/register" style={styles.link}>
                Create an account
              </Link>
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const createStyles = (tokens: ReturnType<typeof useAppTheme>['tokens']) => {
  const colors = {
    gold: tokens.colors.accent,
    gray1: tokens.colors.textMuted,
    gray2: tokens.colors.textCaption,
    warning: tokens.colors.warning,
    white: tokens.colors.text,
    danger: tokens.colors.danger,
  };
  const typography = {
    h1: tokens.typography.h1,
    tagline: tokens.typography.secondary,
    body: tokens.typography.body,
    label: tokens.typography.label,
  };
  return StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-start',
    paddingHorizontal: tokens.spacing.pageX,
  },
  topBlock: {
    width: '100%',
    flex: 1,
  },
  hero: {
    alignItems: 'center',
    marginBottom: tokens.spacing.xl,
    gap: 12,
  },
  wordmark: {
    ...typography.h1,
    fontSize: 46,
    color: colors.gold,
    letterSpacing: 8,
    textAlign: 'center',
  },
  tagline: {
    ...typography.tagline,
    color: colors.gray1,
    textAlign: 'center',
  },
  envWarn: {
    ...typography.body,
    color: colors.warning,
    marginTop: 8,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  formBlock: {
    marginBottom: 0,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    padding: 16,
  },
  label: {
    ...typography.label,
    textTransform: 'uppercase',
    color: colors.gray2,
    marginBottom: 8,
  },
  labelSpaced: {
    marginTop: 16,
  },
  input: {
    ...typography.body,
    color: colors.white,
    borderWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'transparent',
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.backgroundElevated,
  },
  error: {
    ...typography.body,
    color: colors.danger,
    marginTop: 8,
    fontSize: 16,
  },
  submit: {
    marginTop: 24,
    width: '100%',
    minHeight: 52,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.accent,
    backgroundColor: tokens.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: {
    opacity: 0.55,
  },
  submitLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 17,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#241B0A',
  },
  forgot: {
    ...typography.body,
    color: colors.gray2,
    textAlign: 'center',
    marginTop: 16,
  },
  registerRow: {
    ...typography.body,
    color: colors.gray2,
    textAlign: 'center',
    marginTop: 24,
  },
  link: {
    color: colors.gold,
    textDecorationLine: 'underline',
  },
});
};
