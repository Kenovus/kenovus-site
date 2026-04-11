import { zodResolver } from '@hookform/resolvers/zod';
import * as LocalAuthentication from 'expo-local-authentication';
import { Link, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors, typography } from '@/constants/designSystem';
import { getPostAuthHref, isPatientFacingRole } from '@/lib/authRouting';
import { useAuth } from '@/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase';
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
    if (!profile) {
      Alert.alert(
        'Account setup',
        'Your login worked, but no Kenovus profile was found. Ask your clinic to finish provisioning, or contact support.',
      );
      return;
    }
    const onboardingComplete =
      !isPatientFacingRole(profile.role) || patientOnboardingComplete === true;
    router.replace(getPostAuthHref(profile, onboardingComplete));
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

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>SonaLife · Kenovus</Text>
        {!isSupabaseConfigured ? (
          <Text style={styles.envWarn}>
            Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to
            .env, then restart with npx expo start -c
          </Text>
        ) : null}
      </View>

      <Card style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="you@example.com"
              placeholderTextColor={colors.gray2}
              style={styles.input}
              value={value}
            />
          )}
        />
        {errors.email ? <Text style={styles.error}>{errors.email.message}</Text> : null}

        <Text style={[styles.label, styles.labelSpaced]}>Password</Text>
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              autoCapitalize="none"
              autoComplete="password"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="••••••••"
              placeholderTextColor={colors.gray2}
              secureTextEntry
              style={styles.input}
              value={value}
            />
          )}
        />
        {errors.password ? <Text style={styles.error}>{errors.password.message}</Text> : null}

        <Button
          loading={submitting}
          onPress={onSubmit}
          style={styles.submit}
          variant="primary">
          Continue
        </Button>

        <Text onPress={onForgotPassword} style={styles.forgot}>
          Forgot password
        </Text>
      </Card>

      <Text style={styles.registerRow}>
        New here?{' '}
        <Link href="/(auth)/register" style={styles.link}>
          Create an account
        </Link>
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 28,
  },
  title: {
    ...typography.h1,
    color: colors.white,
    marginBottom: 8,
  },
  subtitle: {
    ...typography.body,
    color: colors.gray1,
  },
  envWarn: {
    ...typography.body,
    color: colors.warning,
    fontSize: 13,
    marginTop: 12,
    lineHeight: 18,
  },
  card: {
    marginBottom: 24,
  },
  label: {
    ...typography.label,
    color: colors.gold,
    marginBottom: 8,
  },
  labelSpaced: {
    marginTop: 16,
  },
  input: {
    ...typography.body,
    color: colors.white,
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.dark2,
  },
  error: {
    ...typography.body,
    color: colors.danger,
    marginTop: 6,
    fontSize: 13,
  },
  submit: {
    marginTop: 24,
    width: '100%',
  },
  forgot: {
    ...typography.body,
    color: colors.gray2,
    textAlign: 'center',
    marginTop: 16,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  registerRow: {
    ...typography.body,
    color: colors.gray1,
    textAlign: 'center',
  },
  link: {
    color: colors.goldLight,
    textDecorationLine: 'underline',
  },
});
