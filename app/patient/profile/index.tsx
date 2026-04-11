import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { setUserUiMode } from '@/lib/onboarding/patient';
import { normalizeUiMode } from '@/types/onboarding';

export default function ProfileIndex() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);

  const mode = normalizeUiMode(profile);
  const other: 'guided' | 'explorer' = mode === 'guided' ? 'explorer' : 'guided';

  const swap = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await setUserUiMode(user.id, other);
      if (error) {
        Alert.alert('Could not update', error.message);
        return;
      }
      await refreshProfile();
      router.replace(other === 'guided' ? '/patient/guided-home' : '/patient/dashboard');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.body}>Settings, routine, and devices ship in the next slices.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Display mode</Text>
        <Text style={styles.cardMeta}>
          {mode === 'guided' ? 'Guided — simple and clear' : 'Explorer — full tabs and data'}
        </Text>
        <Button loading={busy} onPress={() => void swap()} style={styles.swap} variant="ghost">
          Switch to {other === 'guided' ? 'Guided' : 'Explorer'}
        </Button>
      </View>

      <Pressable onPress={() => router.push('/patient/profile/ui_mode')} style={styles.linkWrap}>
        <Text style={styles.link}>Open mode screen</Text>
      </Pressable>
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
    marginBottom: 22,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.goldDim,
    padding: 16,
    backgroundColor: colors.darkCard,
    marginBottom: 16,
  },
  cardTitle: {
    ...typography.body,
    color: colors.white,
    fontSize: 17,
    marginBottom: 6,
  },
  cardMeta: {
    ...typography.body,
    color: colors.gray1,
    fontSize: 14,
    marginBottom: 12,
  },
  swap: {
    alignSelf: 'flex-start',
  },
  linkWrap: {
    paddingVertical: 8,
  },
  link: {
    ...typography.body,
    color: colors.goldLight,
    textDecorationLine: 'underline',
  },
});
