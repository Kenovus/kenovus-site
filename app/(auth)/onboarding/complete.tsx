import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { fetchPatientIdForAuthUser, setPatientOnboardingComplete } from '@/lib/onboarding/patient';
import { useAuthStore } from '@/stores/authStore';

export default function OnboardingComplete() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile, refreshProfile } = useAuth();
  const displayName = profile?.full_name;
  const [busy, setBusy] = useState(false);

  const first = displayName?.split(/\s+/)[0] ?? 'there';

  const finish = async () => {
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
      const { error } = await setPatientOnboardingComplete(patientId, true);
      if (error) {
        Alert.alert('Could not finish setup', error.message);
        return;
      }
      await refreshProfile();
      const mode = useAuthStore.getState().profile?.ui_mode;
      router.replace(mode === 'guided' ? '/patient/guided-home' : '/patient/dashboard');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.step}>Step 7 of 7</Text>
      <Text style={styles.title}>You&apos;re all set, {first}.</Text>
      <Text style={styles.body}>
        Your Vitality Score will build as you log. For now, here&apos;s a preview of the ring you&apos;ll
        see every day.
      </Text>

      <View style={styles.ring}>
        <Text style={styles.ringLabel}>Vitality</Text>
        <Text style={styles.ringValue}>—</Text>
      </View>

      <Button loading={busy} onPress={() => void finish()} variant="primary">
        See my dashboard
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
    paddingHorizontal: 24,
  },
  step: {
    ...typography.label,
    color: colors.gold,
    marginBottom: 10,
  },
  title: {
    ...typography.h1,
    color: colors.white,
    marginBottom: 12,
  },
  body: {
    ...typography.body,
    color: colors.gray1,
    marginBottom: 28,
    lineHeight: 22,
  },
  ring: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: colors.goldDim,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  ringLabel: {
    ...typography.label,
    color: colors.gold,
  },
  ringValue: {
    fontFamily: 'CormorantGaramond_300Light',
    fontSize: 48,
    color: colors.white,
    marginTop: 6,
  },
});
