import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
import { useAuth } from '@/hooks/useAuth';
import { fetchPatientIdForAuthUser, updatePatientDemographics } from '@/lib/onboarding/patient';

const schema = z.object({
  firstName: z.string().min(1, 'Add your first name'),
  lastName: z.string().min(1, 'Add your last name'),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date'),
  sex: z.enum(['male', 'female', 'other', 'prefer_not']),
});

type Form = z.infer<typeof schema>;

const SEX_OPTIONS: { value: Form['sex']; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not', label: 'Prefer not to say' },
];

export default function OnboardingProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [busy, setBusy] = useState(false);

  const prefilled = profile?.full_name?.trim().split(/\s+/) ?? [];
  const defaultFirst = prefilled[0] ?? '';
  const defaultLast = prefilled.slice(1).join(' ') ?? '';

  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: defaultFirst,
      lastName: defaultLast,
      dateOfBirth: '',
      sex: 'female',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!user) {
      Alert.alert('Session', 'Sign in again to continue.');
      return;
    }
    setBusy(true);
    try {
      const patientId = await fetchPatientIdForAuthUser(user.id);
      if (!patientId) {
        Alert.alert(
          'Setup required',
          'No patient record is linked to this account yet. Ask your clinic to finish provisioning.',
        );
        return;
      }
      const { error } = await updatePatientDemographics(patientId, {
        first_name: values.firstName.trim(),
        last_name: values.lastName.trim(),
        date_of_birth: values.dateOfBirth,
        sex: values.sex,
      });
      if (error) {
        Alert.alert('Could not save', error.message);
        return;
      }
      router.replace('/(auth)/onboarding/wearables');
    } finally {
      setBusy(false);
    }
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.step}>Step 3 of 7</Text>
        <Text style={styles.title}>A little about you</Text>
        <Text style={styles.sub}>
          We use this for body composition math and to greet you the right way.
        </Text>

        <Card style={styles.card}>
          <Text style={styles.label}>First name</Text>
          <Controller
            control={control}
            name="firstName"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                autoCapitalize="words"
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder="Sarah"
                placeholderTextColor={colors.gray2}
                style={styles.input}
                value={value}
              />
            )}
          />
          {errors.firstName ? <Text style={styles.err}>{errors.firstName.message}</Text> : null}

          <Text style={[styles.label, styles.spaced]}>Last name</Text>
          <Controller
            control={control}
            name="lastName"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                autoCapitalize="words"
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder="Chen"
                placeholderTextColor={colors.gray2}
                style={styles.input}
                value={value}
              />
            )}
          />
          {errors.lastName ? <Text style={styles.err}>{errors.lastName.message}</Text> : null}

          <Text style={[styles.label, styles.spaced]}>Date of birth</Text>
          <Controller
            control={control}
            name="dateOfBirth"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder="1988-04-12"
                placeholderTextColor={colors.gray2}
                style={styles.input}
                value={value}
              />
            )}
          />
          {errors.dateOfBirth ? <Text style={styles.err}>{errors.dateOfBirth.message}</Text> : null}

          <Text style={[styles.label, styles.spaced]}>Biological sex</Text>
          <Controller
            control={control}
            name="sex"
            render={({ field: { onChange, value } }) => (
              <View style={styles.sexRow}>
                {SEX_OPTIONS.map((o) => {
                  const selected = value === o.value;
                  return (
                    <Pressable
                      key={o.value}
                      onPress={() => onChange(o.value)}
                      style={[styles.sexChip, selected && styles.sexChipOn]}>
                      <Text style={[styles.sexLabel, selected && styles.sexLabelOn]}>{o.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          />
        </Card>

        <Button loading={busy} onPress={onSubmit} variant="primary">
          Continue
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
    paddingHorizontal: 20,
  },
  scroll: {
    paddingBottom: 32,
  },
  step: {
    ...typography.label,
    color: colors.gold,
    marginBottom: 8,
  },
  title: {
    ...typography.h2,
    color: colors.white,
    marginBottom: 8,
  },
  sub: {
    ...typography.body,
    color: colors.gray1,
    marginBottom: 20,
  },
  card: {
    marginBottom: 20,
  },
  label: {
    ...typography.label,
    color: colors.gold,
    marginBottom: 8,
  },
  spaced: {
    marginTop: 14,
  },
  input: {
    ...typography.body,
    color: colors.white,
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.dark2,
  },
  err: {
    ...typography.body,
    color: colors.danger,
    marginTop: 6,
    fontSize: 13,
  },
  sexRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sexChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  sexChipOn: {
    borderColor: colors.gold,
    backgroundColor: colors.goldDim,
  },
  sexLabel: {
    ...typography.body,
    color: colors.gray1,
    fontSize: 13,
  },
  sexLabelOn: {
    color: colors.dark,
  },
});
