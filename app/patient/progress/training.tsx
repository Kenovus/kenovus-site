import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { localDateKey } from '@/lib/patientSupplements';
import { fetchPatientTrainingPrefs } from '@/lib/patientTrainingPrefs';
import {
  buildHistoricalMaxWeightMap,
  detectNewPrs,
  fetchLatestTrainingLog,
  fetchTrainingLogs,
  insertTrainingLog,
  MUSCLE_FOCUS_OPTIONS,
  normalizeExerciseSets,
  progressiveOverloadHints,
  rirDriftWithoutLoad,
  fetchPreviousTrainingLog,
  type TrainingExercise,
  type TrainingLogRow,
  type TrainingSetRow,
} from '@/lib/trainingLogs';
import {
  MEV_SETS,
  MAV_HIGH,
  MAV_LOW,
  MRV_HIGH,
  muscleFocusesBelowMevThisWeek,
  weeklySetsByMuscleFocus,
  volumeLandmarkLabel,
} from '@/lib/trainingVolumeLandmarks';
import type { WeightUnit } from '@/lib/weightLogs';

function emptyExercise(): TrainingExercise {
  return {
    name: '',
    set_rows: [
      { reps: 8, weight: 0, rir: 2 },
      { reps: 8, weight: 0, rir: 2 },
      { reps: 8, weight: 0, rir: 2 },
    ],
  };
}

function fromPersistedExercise(e: TrainingExercise): TrainingExercise {
  const rows = normalizeExerciseSets(e);
  return { name: e.name, set_rows: rows.map((r) => ({ ...r })) };
}

function volumeBandCopy(band: ReturnType<typeof volumeLandmarkLabel>): string {
  switch (band) {
    case 'below_mev':
      return `Under MEV (~${MEV_SETS} sets/wk for this focus)`;
    case 'mev_mav':
      return `Between MEV (~${MEV_SETS}) and MAV (~${MAV_LOW}–${MAV_HIGH})`;
    case 'mav':
      return `MAV zone (~${MAV_LOW}–${MAV_HIGH} sets/wk)`;
    case 'mrv':
      return `MRV zone (~${MRV_HIGH}+ sets/wk — watch recovery)`;
    case 'above_mrv':
      return 'Above typical MRV — prioritize recovery';
    default:
      return '';
  }
}

export default function ProgressTraining() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const [patientId, setPatientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workoutDate, setWorkoutDate] = useState(localDateKey(new Date()));
  const [muscleFocus, setMuscleFocus] = useState<string>('full_body');
  const [exercises, setExercises] = useState<TrainingExercise[]>([emptyExercise()]);
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [recent, setRecent] = useState<TrainingLogRow[]>([]);
  const [prefsGoalDays, setPrefsGoalDays] = useState(4);
  const [prModal, setPrModal] = useState<string | null>(null);
  const unit: WeightUnit = profile?.weight_unit_preference === 'kg' ? 'kg' : 'lb';

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const pid = await fetchPatientIdForAuthUser(user.id);
      setPatientId(pid);
      if (!pid) return;
      const [logs, prefs] = await Promise.all([fetchTrainingLogs(pid, 25), fetchPatientTrainingPrefs(pid)]);
      setRecent(logs);
      if (prefs) setPrefsGoalDays(prefs.training_days_per_week);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const prevForHints = useMemo(() => {
    return recent.find((r) => r.muscle_focus === muscleFocus) ?? null;
  }, [recent, muscleFocus]);

  const hints = useMemo(() => {
    const cleaned = exercises.filter((e) => e.name.trim());
    if (!prevForHints || cleaned.length === 0) return {} as Record<string, 'up' | 'down' | 'same' | 'unknown'>;
    return progressiveOverloadHints(cleaned, prevForHints.exercises);
  }, [exercises, prevForHints]);

  const weeklyVol = useMemo(() => weeklySetsByMuscleFocus(recent), [recent]);
  const setsThisFocus = weeklyVol[muscleFocus] ?? 0;
  const volBand = volumeLandmarkLabel(setsThisFocus);
  const lowVolFocuses = useMemo(() => muscleFocusesBelowMevThisWeek(recent), [recent]);

  const repeatLast = async () => {
    if (!patientId) return;
    const last = await fetchLatestTrainingLog(patientId);
    if (!last) {
      Alert.alert('No prior workout', 'Log a session first, then you can repeat it.');
      return;
    }
    setWorkoutDate(localDateKey(new Date()));
    setMuscleFocus(last.muscle_focus);
    setExercises(last.exercises.length ? last.exercises.map((e) => fromPersistedExercise(e)) : [emptyExercise()]);
    setDuration(last.duration_minutes != null ? String(last.duration_minutes) : '');
    setNotes(last.notes ?? '');
  };

  const onSave = async () => {
    if (!patientId) return;
    const cleaned = exercises
      .filter((e) => e.name.trim())
      .map((e) => ({ name: e.name.trim(), set_rows: normalizeExerciseSets(e) }));
    if (cleaned.length === 0) {
      Alert.alert('Add exercises', 'Enter at least one exercise name.');
      return;
    }
    setSaving(true);
    try {
      const maxMap = await buildHistoricalMaxWeightMap(patientId, unit);
      const before = new Map(maxMap);
      const prevSession = await fetchPreviousTrainingLog(patientId, muscleFocus);
      const prs = detectNewPrs(cleaned, before);
      const dur = duration.trim() ? Number.parseInt(duration, 10) : null;
      const { row, error } = await insertTrainingLog({
        patientId,
        workout_date: workoutDate,
        muscle_focus: muscleFocus,
        exercises: cleaned,
        duration_minutes: dur != null && Number.isFinite(dur) ? dur : null,
        notes: notes.trim() || null,
        weight_unit: unit,
      });
      if (error || !row) {
        Alert.alert('Save failed', error ?? 'Unknown error');
        return;
      }
      if (prs.length) {
        setPrModal(`New personal record${prs.length > 1 ? 's' : ''}: ${prs.map((p) => `${p.exercise} @ ${p.weight}${unit}`).join(', ')}`);
      }
      const hintsAfter = progressiveOverloadHints(cleaned, prevSession?.exercises ?? null);
      const downs = Object.values(hintsAfter).filter((h) => h === 'down').length;
      const drift = rirDriftWithoutLoad(cleaned, prevSession?.exercises ?? null);
      const driftAny = Object.values(drift).some(Boolean);
      if (downs > 0 && !prs.length) {
        Alert.alert('Check in', 'Some lifts are below your last same-focus session—totally normal if fatigue or technique changed.');
      } else if (driftAny && !prs.length) {
        Alert.alert(
          'Progressive overload',
          'RIR crept up on some lifts without load moving—when ready, add a little load or a rep while staying around 1–3 RIR most sets.',
        );
      }
      setExercises([emptyExercise()]);
      setDuration('');
      setNotes('');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const updateEx = (i: number, patch: Partial<TrainingExercise>) => {
    setExercises((prev) => {
      const next = [...prev];
      next[i] = { ...next[i]!, ...patch };
      return next;
    });
  };

  const updateSet = (exIndex: number, setIndex: number, patch: Partial<TrainingSetRow>) => {
    setExercises((prev) => {
      const next = [...prev];
      const ex = { ...next[exIndex]! };
      const rows = [...normalizeExerciseSets(ex)];
      rows[setIndex] = { ...rows[setIndex]!, ...patch };
      ex.set_rows = rows;
      next[exIndex] = ex;
      return next;
    });
  };

  const addSet = (exIndex: number) => {
    setExercises((prev) => {
      const next = [...prev];
      const ex = { ...next[exIndex]! };
      const rows = [...normalizeExerciseSets(ex)];
      const last = rows[rows.length - 1] ?? { reps: 8, weight: 0, rir: 2 };
      rows.push({ reps: last.reps, weight: last.weight, rir: last.rir ?? 2 });
      ex.set_rows = rows;
      next[exIndex] = ex;
      return next;
    });
  };

  const removeSet = (exIndex: number, setIndex: number) => {
    setExercises((prev) => {
      const next = [...prev];
      const ex = { ...next[exIndex]! };
      const rows = [...normalizeExerciseSets(ex)];
      if (rows.length <= 1) return prev;
      rows.splice(setIndex, 1);
      ex.set_rows = rows;
      next[exIndex] = ex;
      return next;
    });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={88}>
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 20,
      }}
      keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Training log</Text>
      <Text style={styles.sub}>
        Goal: about {prefsGoalDays} sessions / week. Log sets with reps, load, and RIR (0 = failure, 4 = 4 reps left).
        Target most work around 1–3 RIR.
      </Text>

      <View style={styles.volCard}>
        <Text style={styles.volTitle}>Volume this week · {MUSCLE_FOCUS_OPTIONS.find((x) => x.id === muscleFocus)?.label}</Text>
        <Text style={styles.volBody}>
          {setsThisFocus} hard sets logged · {volumeBandCopy(volBand)}
        </Text>
        <Text style={styles.volHint}>
          Landmarks (per focus / week): MEV ~{MEV_SETS} sets · MAV ~{MAV_LOW}–{MAV_HIGH} · MRV ~{MRV_HIGH}+
        </Text>
        {lowVolFocuses.length > 0 ? (
          <Text style={styles.volWarn}>
            Coach note: {lowVolFocuses.join(', ')} under MEV this week with training logged—consider adding sets gradually if recovery is solid.
          </Text>
        ) : null}
      </View>

      <Button variant="ghost" onPress={() => void repeatLast()} style={styles.repeat}>
        Repeat last session
      </Button>

      <Text style={styles.label}>Workout date</Text>
      <TextInput
        value={workoutDate}
        onChangeText={setWorkoutDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.gray2}
        style={styles.input}
        autoCapitalize="none"
      />

      <Text style={styles.label}>Focus</Text>
      <View style={styles.chipWrap}>
        {MUSCLE_FOCUS_OPTIONS.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => setMuscleFocus(m.id)}
            style={[styles.chip, muscleFocus === m.id && styles.chipOn]}>
            <Text style={[styles.chipText, muscleFocus === m.id && styles.chipTextOn]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Exercises ({unit})</Text>
      {exercises.map((ex, i) => (
        <View key={i} style={styles.exCard}>
          <View style={styles.exHead}>
            <Text style={styles.hint}>
              {hints[ex.name] === 'up' ? '↑' : hints[ex.name] === 'down' ? '↓' : hints[ex.name] === 'same' ? '→' : ''}
            </Text>
            <TextInput
              value={ex.name}
              onChangeText={(t) => updateEx(i, { name: t })}
              placeholder="Exercise name"
              placeholderTextColor={colors.gray2}
              style={[styles.input, styles.flex1]}
            />
          </View>
          {normalizeExerciseSets(ex).map((row, si) => (
            <View key={si} style={styles.setRow}>
              <View style={styles.setMini}>
                <Text style={styles.miniLabel}>Reps</Text>
                <TextInput
                  value={row.reps ? String(row.reps) : ''}
                  onChangeText={(t) => updateSet(i, si, { reps: Math.max(0, Number.parseInt(t, 10) || 0) })}
                  keyboardType="number-pad"
                  style={styles.input}
                />
              </View>
              <View style={styles.setMini}>
                <Text style={styles.miniLabel}>Weight</Text>
                <TextInput
                  value={row.weight ? String(row.weight) : ''}
                  onChangeText={(t) => updateSet(i, si, { weight: Number.parseFloat(t) || 0 })}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </View>
              <View style={styles.rirCol}>
                <Text style={styles.miniLabel}>RIR</Text>
                <View style={styles.rirRow}>
                  {([0, 1, 2, 3, 4] as const).map((r) => (
                    <Pressable
                      key={r}
                      onPress={() => updateSet(i, si, { rir: r })}
                      style={[styles.rirChip, (row.rir ?? 2) === r && styles.rirChipOn]}>
                      <Text style={[styles.rirChipText, (row.rir ?? 2) === r && styles.rirChipTextOn]}>{r}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              {normalizeExerciseSets(ex).length > 1 ? (
                <Pressable onPress={() => removeSet(i, si)} style={styles.removeSet}>
                  <Text style={styles.removeSetText}>×</Text>
                </Pressable>
              ) : (
                <View style={styles.removeSet} />
              )}
            </View>
          ))}
          <Button variant="ghost" onPress={() => addSet(i)} style={styles.addSetBtn}>
            + Add set
          </Button>
          {exercises.length > 1 ? (
            <Pressable onPress={() => setExercises((p) => p.filter((_, j) => j !== i))}>
              <Text style={styles.remove}>Remove exercise</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      <Button variant="ghost" onPress={() => setExercises((p) => [...p, emptyExercise()])}>
        + Add exercise
      </Button>

      <Text style={styles.label}>Duration (minutes, optional)</Text>
      <TextInput
        value={duration}
        onChangeText={setDuration}
        keyboardType="number-pad"
        placeholder="45"
        placeholderTextColor={colors.gray2}
        style={styles.input}
      />

      <Text style={styles.label}>Notes</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="How it felt, RPE, injuries…"
        placeholderTextColor={colors.gray2}
        style={[styles.input, styles.notes]}
        multiline
      />

      <Button variant="primary" loading={saving} onPress={() => void onSave()} style={styles.save}>
        Save workout
      </Button>

      <Text style={styles.section}>Recent</Text>
      {loading ? <Text style={styles.meta}>Loading…</Text> : null}
      {recent.map((r) => (
        <View key={r.id} style={styles.pastCard}>
          <Text style={styles.pastTitle}>
            {r.workout_date} · {MUSCLE_FOCUS_OPTIONS.find((x) => x.id === r.muscle_focus)?.label ?? r.muscle_focus}
          </Text>
          {r.exercises.map((e) => (
            <Text key={`${r.id}-${e.name}`} style={styles.pastLine}>
              {e.name}{' '}
              {normalizeExerciseSets(e)
                .map((s) => `${s.reps}@${s.weight}${r.weight_unit}${s.rir != null ? ` R${s.rir}` : ''}`)
                .join(' · ')}
            </Text>
          ))}
        </View>
      ))}

      <Modal visible={Boolean(prModal)} transparent animationType="fade">
        <Pressable style={styles.modalBg} onPress={() => setPrModal(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>PR</Text>
            <Text style={styles.modalBody}>{prModal}</Text>
            <Button variant="primary" onPress={() => setPrModal(null)}>
              Nice work
            </Button>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backBtn: { alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 6 },
  backText: { ...typography.body, color: colors.gold, fontSize: 16 },
  screen: { flex: 1, backgroundColor: colors.dark },
  title: { ...typography.h2, color: colors.white, marginBottom: 6 },
  sub: { ...typography.body, color: colors.gray1, marginBottom: 12 },
  volCard: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: colors.darkCard,
  },
  volTitle: { color: colors.gold, fontWeight: '700', marginBottom: 6 },
  volBody: { color: colors.white, marginBottom: 4 },
  volHint: { color: colors.gray2, fontSize: 12, lineHeight: 17 },
  volWarn: { color: colors.warning, fontSize: 12, marginTop: 8, lineHeight: 17 },
  repeat: { alignSelf: 'flex-start', marginBottom: 12 },
  label: { ...typography.label, color: colors.gold, marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.white,
    ...typography.body,
    backgroundColor: colors.dark2,
  },
  notes: { minHeight: 72, textAlignVertical: 'top' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: colors.darkCard,
  },
  chipOn: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.15)' },
  chipText: { color: colors.gray1, fontSize: 13 },
  chipTextOn: { color: colors.goldLight, fontWeight: '600' },
  exCard: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: colors.darkCard,
  },
  exHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  hint: { width: 22, fontSize: 18, color: colors.goldLight },
  flex1: { flex: 1 },
  setRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 8 },
  setMini: { flex: 1 },
  miniLabel: { color: colors.gray2, fontSize: 11, marginBottom: 4 },
  rirCol: { flex: 1.4 },
  rirRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  rirChip: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: colors.dark2,
  },
  rirChipOn: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.2)' },
  rirChipText: { color: colors.gray1, fontSize: 12 },
  rirChipTextOn: { color: colors.goldLight, fontWeight: '700' },
  removeSet: { width: 28, alignItems: 'center', justifyContent: 'center', paddingBottom: 4 },
  removeSetText: { color: colors.warning, fontSize: 20 },
  addSetBtn: { alignSelf: 'flex-start', marginTop: 4 },
  remove: { color: colors.warning, marginTop: 8, fontSize: 13 },
  save: { marginTop: 20 },
  section: { ...typography.h2, fontSize: 22, color: colors.white, marginTop: 28, marginBottom: 8 },
  meta: { color: colors.gray2 },
  pastCard: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: colors.darkCard,
  },
  pastTitle: { color: colors.white, fontWeight: '600', marginBottom: 6 },
  pastLine: { color: colors.gray1, fontSize: 13 },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.darkCard,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  modalTitle: { ...typography.h2, color: colors.gold, marginBottom: 8 },
  modalBody: { ...typography.body, color: colors.white, marginBottom: 16 },
});
