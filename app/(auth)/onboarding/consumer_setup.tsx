import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import {
  fetchPatientIdForAuthUser,
  setConsumerTierAndTrack,
} from '@/lib/onboarding/patient';

type Tier = 'free' | 'core' | 'glp1_plus';
type Track = 'hormone_optimization' | 'fitness_recomp' | 'wellness';

export default function ConsumerSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshProfile } = useAuth();
  const [tier, setTier] = useState<Tier>('free');
  const [track, setTrack] = useState<Track>('wellness');
  const [busy, setBusy] = useState(false);

  const onContinue = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const patientId = await fetchPatientIdForAuthUser(user.id);
      if (!patientId) {
        Alert.alert('Setup required', 'Missing patient row. Please sign out and back in.');
        return;
      }
      const { error } = await setConsumerTierAndTrack(user.id, patientId, { tier, track });
      if (error) {
        Alert.alert('Could not save', error.message);
        return;
      }
      await refreshProfile();
      router.replace('/(auth)/onboarding/complete');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.step}>Step 6d of 8</Text>
      <Text style={styles.title}>Choose your plan and track</Text>
      <Text style={styles.body}>This sets your consumer experience and non-GLP-1 coaching track.</Text>

      <Text style={styles.section}>Tier</Text>
      <View style={styles.row}>
        {[
          ['free', 'Free'],
          ['core', 'Core'],
          ['glp1_plus', 'GLP-1+'],
        ].map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() => setTier(id as Tier)}
            style={[styles.chip, tier === id && styles.chipOn]}>
            <Text style={[styles.chipText, tier === id && styles.chipTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>Non-GLP-1 Track</Text>
      <View style={styles.row}>
        {[
          ['wellness', 'Wellness'],
          ['fitness_recomp', 'Fitness Recomp'],
          ['hormone_optimization', 'Hormone Optimization'],
        ].map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() => setTrack(id as Track)}
            style={[styles.chip, track === id && styles.chipOn]}>
            <Text style={[styles.chipText, track === id && styles.chipTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Button loading={busy} onPress={() => void onContinue()} variant="primary">
        Continue
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark, paddingHorizontal: 22 },
  step: { ...typography.label, color: colors.gold, marginBottom: 10 },
  title: { ...typography.h2, color: colors.white, marginBottom: 8 },
  body: { ...typography.body, color: colors.gray1, marginBottom: 16 },
  section: { ...typography.label, color: colors.goldLight, marginBottom: 8, marginTop: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  chipOn: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.2)' },
  chipText: { ...typography.body, color: colors.gray1, fontSize: 13 },
  chipTextOn: { color: colors.white },
});
