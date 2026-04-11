import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { guidedScreen } from '@/constants/guidedUi';
import { useAuth } from '@/hooks/useAuth';

const MOODS = ['Great 😊', 'Pretty good', 'Not great', 'Rough day'] as const;

export default function GuidedHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const [mood, setMood] = useState<string | null>(null);

  const first = profile?.full_name?.split(/\s+/)[0] ?? 'there';
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <Text style={styles.greet}>
        {greet}, {first}.
      </Text>
      <Text style={styles.question}>How are you feeling today?</Text>

      <View style={styles.moodRow}>
        {MOODS.map((m) => {
          const on = mood === m;
          return (
            <Pressable
              key={m}
              onPress={() => setMood(m)}
              style={[styles.moodChip, on && styles.moodChipOn]}>
              <Text style={[styles.moodText, on && styles.moodTextOn]}>{m}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.hint}>
        In Guided mode, your coach is the front door. More actions will route here from the AI layer in
        Week 2.
      </Text>

      <View style={styles.actions}>
        <Button onPress={() => router.push('/patient/coach')} variant="primary">
          Open coach
        </Button>
        <Button onPress={() => router.push('/patient/nutrition')} style={styles.secondary} variant="ghost">
          Log food
        </Button>
        <Button onPress={() => router.push('/patient/progress/weight')} variant="ghost">
          Log weight
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
    paddingHorizontal: 20,
  },
  greet: {
    fontFamily: 'CormorantGaramond_300Light',
    fontSize: guidedScreen.bodyFontSize + 8,
    color: colors.white,
    marginBottom: 12,
  },
  question: {
    fontFamily: 'Jost_300Light',
    fontSize: guidedScreen.bodyFontSize,
    color: colors.gray1,
    marginBottom: 20,
  },
  moodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  moodChip: {
    minHeight: guidedScreen.minTapHeight,
    paddingHorizontal: 18,
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: colors.darkCard,
  },
  moodChipOn: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(201,168,76,0.2)',
  },
  moodText: {
    fontFamily: 'Jost_300Light',
    fontSize: guidedScreen.buttonFontSize - 2,
    color: colors.white,
  },
  moodTextOn: {
    color: colors.goldLight,
  },
  hint: {
    fontFamily: 'Jost_300Light',
    fontSize: guidedScreen.labelFontSize,
    color: colors.gray2,
    lineHeight: 20,
    marginBottom: 24,
  },
  actions: {
    gap: 12,
    marginTop: 'auto',
  },
  secondary: {
    marginTop: 4,
  },
});
