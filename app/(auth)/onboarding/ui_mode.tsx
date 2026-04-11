import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { setUserUiMode } from '@/lib/onboarding/patient';
import type { UIMode } from '@/types/user';

export default function OnboardingUiMode() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshProfile } = useAuth();
  const [mode, setMode] = useState<UIMode | null>(null);
  const [busy, setBusy] = useState(false);

  const saveAndNext = async () => {
    if (!mode || !user) {
      Alert.alert('Choose one', 'Pick how you like to use the app — you can change this anytime.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await setUserUiMode(user.id, mode);
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
      <Text style={styles.step}>Step 6b of 7</Text>
      <Text style={styles.title}>One quick preference</Text>
      <Text style={styles.body}>How do you like to use apps?</Text>

      <Pressable
        onPress={() => setMode('guided')}
        style={[styles.card, mode === 'guided' && styles.cardOn]}>
        <Text style={styles.emoji}>🤝</Text>
        <Text style={styles.cardTitle}>Guide me through it</Text>
        <Text style={styles.cardSub}>I prefer simple and clear</Text>
      </Pressable>

      <Pressable
        onPress={() => setMode('explorer')}
        style={[styles.card, mode === 'explorer' && styles.cardOn]}>
        <Text style={styles.emoji}>🗂</Text>
        <Text style={styles.cardTitle}>I&apos;ll explore on my own</Text>
        <Text style={styles.cardSub}>I like seeing all the data</Text>
      </Pressable>

      <Text style={styles.hint}>You can change this anytime in Settings.</Text>

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
    marginBottom: 20,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.goldDim,
    padding: 20,
    marginBottom: 14,
    backgroundColor: colors.darkCard,
  },
  cardOn: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(201,168,76,0.12)',
  },
  emoji: {
    fontSize: 28,
    marginBottom: 10,
  },
  cardTitle: {
    ...typography.body,
    color: colors.white,
    fontSize: 18,
    marginBottom: 6,
  },
  cardSub: {
    ...typography.body,
    color: colors.gray1,
    fontSize: 14,
  },
  hint: {
    ...typography.body,
    color: colors.gray2,
    fontSize: 13,
    marginBottom: 20,
    marginTop: 4,
  },
});
