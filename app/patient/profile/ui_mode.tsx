import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { setUserUiMode } from '@/lib/onboarding/patient';
import { useAppTheme } from '@/lib/theme/ThemeProvider';
import type { UIMode } from '@/types/user';

export default function ProfileUiModeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile, refreshProfile } = useAuth();
  const { tokens } = useAppTheme();
  const styles = createStyles(tokens);
  const [mode, setMode] = useState<UIMode>('guided');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode(profile?.ui_mode === 'explorer' ? 'explorer' : 'guided');
  }, [profile?.ui_mode]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await setUserUiMode(user.id, mode);
      if (error) {
        Alert.alert('Could not save', error.message);
        return;
      }
      await refreshProfile();
      router.replace('/patient/home' as Href);
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
        style={[styles.primaryCard, mode === 'guided' && styles.primaryCardOn]}>
        <Text style={styles.emoji}>🤝</Text>
        <Text style={styles.primaryTitle}>Guide me</Text>
        <Text style={styles.recommended}>Recommended</Text>
        <Text style={styles.primarySub}>Simple home screen with My Coach and key steps upfront</Text>
      </Pressable>

      <Pressable onPress={() => setMode('explorer')} style={styles.selfGuidedWrap} hitSlop={8}>
        <Text
          style={[styles.selfGuidedText, mode === 'explorer' && styles.selfGuidedTextSelected]}
          numberOfLines={2}>
          I prefer Self-Guided
        </Text>
        <Text style={styles.selfGuidedHint}>Full tabs, progress, nutrition, and more</Text>
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

const createStyles = (tokens: ReturnType<typeof useAppTheme>['tokens']) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.colors.background,
    paddingHorizontal: tokens.spacing.pageX,
  },
  title: {
    ...tokens.typography.h2,
    color: tokens.colors.text,
    marginBottom: 8,
  },
  body: {
    ...tokens.typography.body,
    color: tokens.colors.textMuted,
    marginBottom: 18,
  },
  primaryCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 20,
    marginBottom: 14,
    backgroundColor: tokens.colors.surface,
  },
  primaryCardOn: {
    borderColor: tokens.colors.accent,
    backgroundColor: tokens.colors.accentSoft,
  },
  emoji: {
    fontSize: 26,
    marginBottom: 8,
  },
  primaryTitle: {
    ...tokens.typography.body,
    color: tokens.colors.text,
    fontSize: 20,
    marginBottom: 4,
    fontWeight: '600',
  },
  recommended: {
    ...tokens.typography.label,
    color: tokens.colors.accent,
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  primarySub: {
    ...tokens.typography.secondary,
    color: tokens.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  selfGuidedWrap: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  selfGuidedText: {
    fontFamily: 'Jost_300Light',
    fontSize: 15,
    color: tokens.colors.textCaption,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  selfGuidedTextSelected: {
    color: tokens.colors.accent,
  },
  selfGuidedHint: {
    ...tokens.typography.caption,
    color: tokens.colors.textCaption,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  back: {
    marginTop: 10,
  },
});
