import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import {
  fetchOnboardingContext,
  fetchPatientIdForAuthUser,
  setUserUiMode,
} from '@/lib/onboarding/patient';
import type { UIMode } from '@/types/user';

export default function OnboardingUiMode() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshProfile } = useAuth();
  const [mode, setMode] = useState<UIMode>('guided');
  const [busy, setBusy] = useState(false);

  const saveAndNext = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await setUserUiMode(user.id, mode);
      if (error) {
        Alert.alert('Could not save', error.message);
        return;
      }
      await refreshProfile();
      const patientId = await fetchPatientIdForAuthUser(user.id);
      const ctx = patientId ? await fetchOnboardingContext(patientId) : null;
      if (ctx?.clinic_connection === 'consumer' && ctx.is_glp1_patient === false) {
        router.replace('/(auth)/onboarding/consumer_persona' as Href);
        return;
      }
      router.replace('/(auth)/onboarding/complete');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.step}>Step 6b of 7</Text>
      <Text style={styles.title}>One quick preference</Text>
      <Text style={styles.body}>How do you like to use apps?</Text>

      <Pressable
        onPress={() => setMode('guided')}
        style={[styles.primaryCard, mode === 'guided' && styles.primaryCardOn]}>
        <Text style={styles.emoji}>🤝</Text>
        <Text style={styles.primaryTitle}>Guide me</Text>
        <Text style={styles.recommended}>Recommended</Text>
        <Text style={styles.primarySub}>Simple home screen with My Coach and key steps upfront</Text>
      </Pressable>

      <Pressable
        onPress={() => setMode('explorer')}
        style={styles.selfGuidedWrap}
        hitSlop={8}>
        <Text
          style={[styles.selfGuidedText, mode === 'explorer' && styles.selfGuidedTextSelected]}
          numberOfLines={2}>
          I prefer Self-Guided
        </Text>
        <Text style={styles.selfGuidedHint}>Full tabs, progress, nutrition, and more</Text>
      </Pressable>

      <Text style={styles.hint}>You can change this anytime in Profile.</Text>

      <Button loading={busy} onPress={() => void saveAndNext()} variant="primary">
        Continue
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
    paddingHorizontal: 22,
  },
  step: {
    ...typography.label,
    color: colors.gold,
    marginBottom: 10,
  },
  title: {
    ...typography.h2,
    color: colors.white,
    marginBottom: 8,
  },
  body: {
    ...typography.body,
    color: colors.gray1,
    marginBottom: 18,
  },
  primaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.goldDim,
    padding: 22,
    marginBottom: 16,
    backgroundColor: colors.darkCard,
  },
  primaryCardOn: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(201,168,76,0.14)',
  },
  emoji: {
    fontSize: 28,
    marginBottom: 10,
  },
  primaryTitle: {
    ...typography.body,
    color: colors.white,
    fontSize: 22,
    marginBottom: 4,
    fontWeight: '600',
  },
  recommended: {
    ...typography.label,
    color: colors.goldLight,
    fontSize: 12,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  primarySub: {
    ...typography.body,
    color: colors.gray1,
    fontSize: 15,
    lineHeight: 22,
  },
  selfGuidedWrap: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    maxWidth: '100%',
  },
  selfGuidedText: {
    fontFamily: 'Jost_300Light',
    fontSize: 15,
    color: colors.gray2,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  selfGuidedTextSelected: {
    color: colors.goldLight,
  },
  selfGuidedHint: {
    ...typography.body,
    color: colors.gray2,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  hint: {
    ...typography.body,
    color: colors.gray2,
    fontSize: 13,
    marginBottom: 20,
    marginTop: 4,
  },
});
