import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  ImageBackground,
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
import { colors, typography } from '@/constants/designSystem';
import { getPostAuthHref, isPatientFacingRole } from '@/lib/authRouting';
import { useAuth } from '@/hooks/useAuth';
import { useAppTheme } from '@/lib/theme/ThemeProvider';
import { useAuthStore } from '@/stores/authStore';

const registerSchema = z
  .object({
    email: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'Use at least 8 characters'),
    confirm: z.string().min(8, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tokens } = useAppTheme();
  const styles = createStyles(tokens);
  const { signUp } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', confirm: '' },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setSubmitting(true);
    try {
      const { error } = await signUp(email, password);
      if (error) {
        Alert.alert('Sign up failed', error.message);
        return;
      }
      const profile = useAuthStore.getState().profile;
      const patientOnboardingComplete = useAuthStore.getState().patientOnboardingComplete;
      const superAdminViewMode = useAuthStore.getState().superAdminViewMode;
      if (!profile) {
        Alert.alert(
          'Check your email',
          'Confirm your address if prompted. Your clinic will link this account to SonaLife.',
        );
        router.replace('/(auth)/login');
        return;
      }
      const onboardingComplete =
        !isPatientFacingRole(profile.role) || patientOnboardingComplete === true;
      router.replace(getPostAuthHref(profile, onboardingComplete, superAdminViewMode));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <ImageBackground source={require('@/assets/images/sonalife-splash.png')} style={styles.screen} resizeMode="cover">
      <KeyboardAvoidingView
        style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.title}>Join SonaLife</Text>
          <Text style={styles.subtitle}>One account. Your clinic recognizes you automatically.</Text>
        </View>

        <View style={styles.card}>
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
                placeholderTextColor={tokens.colors.textCaption}
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
                autoComplete="new-password"
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder="••••••••"
                placeholderTextColor={tokens.colors.textCaption}
                secureTextEntry
                style={styles.input}
                value={value}
              />
            )}
          />
          {errors.password ? <Text style={styles.error}>{errors.password.message}</Text> : null}

          <Text style={[styles.label, styles.labelSpaced]}>Confirm password</Text>
          <Controller
            control={control}
            name="confirm"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                autoCapitalize="none"
                autoComplete="new-password"
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder="••••••••"
                placeholderTextColor={tokens.colors.textCaption}
                secureTextEntry
                style={styles.input}
                value={value}
              />
            )}
          />
          {errors.confirm ? <Text style={styles.error}>{errors.confirm.message}</Text> : null}

          <Button
            loading={submitting}
            onPress={onSubmit}
            style={styles.submit}
            variant="primary">
            Create account
          </Button>
        </View>

        <Text style={styles.registerRow}>
          Already have an account?{' '}
          <Link href="/(auth)/login" style={styles.link}>
            Welcome back
          </Link>
        </Text>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const createStyles = (tokens: ReturnType<typeof useAppTheme>['tokens']) => {
  const colors = {
    gold: tokens.colors.accent,
    gray1: tokens.colors.textMuted,
    gray2: tokens.colors.textCaption,
    white: tokens.colors.text,
    danger: tokens.colors.danger,
  };
  const typography = {
    h1: tokens.typography.h1,
    body: tokens.typography.body,
    label: tokens.typography.label,
  };
  return StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    height: '100%',
    paddingHorizontal: tokens.spacing.pageX,
  },
  header: {
    marginBottom: 24,
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
  card: {
    marginBottom: 24,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    padding: 16,
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
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: tokens.colors.backgroundElevated,
  },
  error: {
    ...typography.body,
    color: colors.danger,
    marginTop: 8,
    fontSize: 15,
  },
  submit: {
    marginTop: 24,
    width: '100%',
  },
  registerRow: {
    ...typography.body,
    color: colors.gray1,
    textAlign: 'center',
  },
  link: {
    color: colors.gold,
    textDecorationLine: 'underline',
  },
});
};
