import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { setUserUiMode } from '@/lib/onboarding/patient';
import type { UIMode } from '@/types/user';

export default function ProfileUiModeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile, refreshProfile } = useAuth();
  const [mode, setMode] = useState<UIMode | null>(profile?.ui_mode ?? 'explorer');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!mode || !user) return;
    setBusy(true);
    try {
      const { error } = await setUserUiMode(user.id, mode);
      if (error) {
        Alert.alert('Could not save', error.message);
        return;
      }
      await refreshProfile();
      router.replace(mode === 'guided' ? '/patient/guided-home' : '/patient/dashboard');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.title}>How do you like to use apps?</Text>
      <Text style={styles.body}>You can change this anytime — one tap, no confirmation.</Text>

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

      <Button loading={busy} onPress={() => void save()} variant="primary">
        Save
      </Button>
      <Button onPress={() => router.back()} style={styles.back} variant="ghost">
        Cancel
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
    padding: 18,
    marginBottom: 12,
    backgroundColor: colors.darkCard,
  },
  cardOn: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(201,168,76,0.12)',
  },
  emoji: {
    fontSize: 26,
    marginBottom: 8,
  },
  cardTitle: {
    ...typography.body,
    color: colors.white,
    fontSize: 17,
    marginBottom: 4,
  },
  cardSub: {
    ...typography.body,
    color: colors.gray1,
    fontSize: 14,
  },
  back: {
    marginTop: 10,
  },
});
