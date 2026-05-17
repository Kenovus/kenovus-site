import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

const GOALS: { id: string; label: string }[] = [
  { id: 'lose_weight', label: 'Lose weight' },
  { id: 'get_healthier', label: 'Get healthier' },
  { id: 'health_questions', label: 'Ask health questions' },
  { id: 'post_surgery', label: 'Post-surgery recovery' },
  { id: 'manage_condition', label: 'Manage a condition' },
];

const ACTIVITY: { id: string; label: string }[] = [
  { id: 'very_active', label: 'Very active' },
  { id: 'moderate', label: 'Moderately active' },
  { id: 'limited_mobility', label: 'Limited mobility' },
  { id: 'recovering_surgery', label: 'Recovering from surgery' },
];

const AGES: { id: string; label: string }[] = [
  { id: '18-35', label: '18–35' },
  { id: '36-50', label: '36–50' },
  { id: '51-65', label: '51–65' },
  { id: '65+', label: '65+' },
];

function resolvePrimaryPersona(goal: string, activity: string, age: string): string {
  if (age === '65+' || activity === 'limited_mobility' || activity === 'recovering_surgery' || goal === 'post_surgery') {
    return 'geriatric_recovery';
  }
  if (goal === 'lose_weight' && activity === 'very_active') {
    return 'performance';
  }
  return 'consumer';
}

export default function ConsumerPersonaOnboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshProfile } = useAuth();
  const [goal, setGoal] = useState<string | null>(null);
  const [activity, setActivity] = useState<string | null>(null);
  const [age, setAge] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const primaryPersona = useMemo(
    () => (goal && activity && age ? resolvePrimaryPersona(goal, activity, age) : null),
    [goal, activity, age],
  );

  const onContinue = async () => {
    if (!user?.id || !goal || !activity || !age || !primaryPersona) {
      Alert.alert('Almost there', 'Please answer all three questions.');
      return;
    }
    setBusy(true);
    try {
      const persona_goal = GOALS.find((g) => g.id === goal)?.label ?? goal;
      const { error } = await supabase
        .from('user_profiles')
        .update({
          persona_goal,
          activity_level_persona: activity,
          age_range: age,
          primary_persona: primaryPersona,
        })
        .eq('auth_user_id', user.id)
        .select('id')
        .maybeSingle();

      if (error) {
        Alert.alert(
          'Could not save persona settings',
          'We could not save your answers right now. Please try again in a moment.',
        );
        console.warn('[consumer_persona] save failed', error.message);
        return;
      }
      await refreshProfile({ keepProfileReady: true });
      router.replace('/(auth)/onboarding/consumer_setup');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 16 }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.step}>Step 6c of 8</Text>
        <Text style={styles.title}>Personalize your coach</Text>
        <Text style={styles.body}>Three quick questions so Sona can match tone and priorities to you.</Text>

        <Text style={styles.q}>1. What&apos;s your main goal?</Text>
        <View style={styles.rowWrap}>
          {GOALS.map((g) => (
            <Pressable
              key={g.id}
              onPress={() => setGoal(g.id)}
              style={[styles.chip, goal === g.id && styles.chipOn]}>
              <Text style={[styles.chipText, goal === g.id && styles.chipTextOn]}>{g.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.q}>2. How active are you?</Text>
        <View style={styles.rowWrap}>
          {ACTIVITY.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => setActivity(a.id)}
              style={[styles.chip, activity === a.id && styles.chipOn]}>
              <Text style={[styles.chipText, activity === a.id && styles.chipTextOn]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.q}>3. Age range?</Text>
        <View style={styles.rowWrap}>
          {AGES.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => setAge(a.id)}
              style={[styles.chip, age === a.id && styles.chipOn]}>
              <Text style={[styles.chipText, age === a.id && styles.chipTextOn]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        <Button loading={busy} onPress={() => void onContinue()} variant="primary">
          Continue
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark, paddingHorizontal: 22 },
  scroll: { paddingBottom: 24, gap: 4 },
  step: { ...typography.label, color: colors.gold, marginBottom: 8 },
  title: { ...typography.h2, color: colors.white, marginBottom: 8 },
  body: { ...typography.body, color: colors.gray1, marginBottom: 18 },
  q: { ...typography.body, color: colors.white, marginTop: 14, marginBottom: 10, fontWeight: '600' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.goldDim,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.darkCard,
  },
  chipOn: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.14)' },
  chipText: { ...typography.body, color: colors.gray1, fontSize: 15 },
  chipTextOn: { color: colors.goldLight },
});
