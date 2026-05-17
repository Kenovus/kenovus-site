import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { fetchSkincareRoutine, fetchSkincareStreak, saveSkincareLog, upsertSkincareRoutine } from '@/lib/aestheticRoutines';

const DEFAULT_AM = ['Cleanser', 'Vitamin C', 'Moisturizer', 'SPF'];
const DEFAULT_PM = ['Cleanser', 'Retinol', 'Moisturizer'];

export default function SkincareRoutineScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [am, setAm] = useState<string[]>(DEFAULT_AM);
  const [pm, setPm] = useState<string[]>(DEFAULT_PM);
  const [amDone, setAmDone] = useState<string[]>([]);
  const [pmDone, setPmDone] = useState<string[]>([]);
  const [newStep, setNewStep] = useState('');
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [amRows, pmRows, s] = await Promise.all([
        fetchSkincareRoutine(user.id, 'am'),
        fetchSkincareRoutine(user.id, 'pm'),
        fetchSkincareStreak(user.id),
      ]);
      if (amRows.length) setAm(amRows);
      if (pmRows.length) setPm(pmRows);
      setStreak(s);
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    const date = new Date().toISOString().slice(0, 10);
    await Promise.all([
      upsertSkincareRoutine(user.id, 'am', am),
      upsertSkincareRoutine(user.id, 'pm', pm),
      saveSkincareLog({
        authUserId: user.id,
        date,
        routineType: 'am',
        completed: amDone.length >= am.length && am.length > 0,
        stepsCompleted: amDone,
      }),
      saveSkincareLog({
        authUserId: user.id,
        date,
        routineType: 'pm',
        completed: pmDone.length >= pm.length && pm.length > 0,
        stepsCompleted: pmDone,
      }),
    ]);
    const s = await fetchSkincareStreak(user.id);
    setStreak(s);
    Alert.alert('Saved', 'Skincare routine + compliance log saved.');
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 30, paddingHorizontal: 20 }}>
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Skincare routine tracker</Text>
      <Text style={styles.meta}>AM reminder 8:00 · PM reminder 9:00 · Current streak: {streak} days</Text>
      <RoutineCard title="AM routine" steps={am} done={amDone} setDone={setAmDone} />
      <RoutineCard title="PM routine" steps={pm} done={pmDone} setDone={setPmDone} />
      <View style={styles.card}>
        <Text style={styles.h}>Add custom product step</Text>
        <TextInput value={newStep} onChangeText={setNewStep} placeholder="Ex: Niacinamide serum" placeholderTextColor={colors.gray2} style={styles.input} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            variant="ghost"
            onPress={() => {
              const s = newStep.trim();
              if (!s) return;
              setAm((v) => [...v, s]);
              setNewStep('');
            }}>
            Add to AM
          </Button>
          <Button
            variant="ghost"
            onPress={() => {
              const s = newStep.trim();
              if (!s) return;
              setPm((v) => [...v, s]);
              setNewStep('');
            }}>
            Add to PM
          </Button>
        </View>
      </View>
      <Button onPress={() => void save()}>Save routine + today compliance</Button>
    </ScrollView>
  );
}

function RoutineCard({
  title,
  steps,
  done,
  setDone,
}: {
  title: string;
  steps: string[];
  done: string[];
  setDone: (s: string[]) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.h}>{title}</Text>
      {steps.map((s) => {
        const on = done.includes(s);
        return (
          <Pressable key={s} onPress={() => setDone(on ? done.filter((x) => x !== s) : [...done, s])} style={styles.step}>
            <Text style={[styles.stepTxt, on && styles.stepOn]}>{on ? '✓ ' : '○ '}{s}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.dark },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 6 },
  backText: { ...typography.body, color: colors.gold, fontSize: 16 },
  title: { ...typography.h2, color: colors.white, marginBottom: 6 },
  meta: { ...typography.body, color: colors.gray1, fontSize: 13, marginBottom: 10 },
  card: { borderWidth: 1, borderColor: colors.goldDim, borderRadius: 12, backgroundColor: colors.darkCard, padding: 12, marginBottom: 10 },
  h: { ...typography.body, color: colors.goldLight, marginBottom: 8 },
  input: { ...typography.body, color: colors.white, borderWidth: 1, borderColor: colors.goldDim, borderRadius: 10, backgroundColor: colors.dark2, padding: 10, marginBottom: 8 },
  step: { paddingVertical: 7 },
  stepTxt: { ...typography.body, color: colors.gray1 },
  stepOn: { color: colors.white },
});
