import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from 'expo-router';
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
      router.replace(getPostAuthHref(profile, onboardingComplete));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.title}>Join SonaLife</Text>
        <Text style={styles.subtitle}>One account. Your clinic recognizes you automatically.</Text>
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
              autoComplete="new-password"
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
              placeholderTextColor={colors.gray2}
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
      </Card>

      <Text style={styles.registerRow}>
        Already have an account?{' '}
        <Link href="/(auth)/login" style={styles.link}>
          Welcome back
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
