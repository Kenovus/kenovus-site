/**
 * Log Workout screen — add a training session to training_logs.
 */
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/theme/ThemeProvider';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import {
  insertTrainingLog,
  MUSCLE_FOCUS_OPTIONS,
  type TrainingExercise,
  type TrainingSetRow,
} from '@/lib/trainingLogs';
import { useAuth } from '@/hooks/useAuth';

const GOLD = '#BF8D36';

// ── helpers ───────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function emptySet(): TrainingSetRow {
  return { reps: 0, weight: 0, rir: null };
}

function emptyExercise(): DraftExercise {
  return { name: '', sets: [emptySet()] };
}

interface DraftExercise {
  name: string;
  sets: TrainingSetRow[];
}

// ── sub-components ────────────────────────────────────────────────────────────
function SetRow({
  set,
  setIdx,
  onChange,
  onDelete,
  CARD,
  BORD,
  TX,
  MT,
}: {
  set: TrainingSetRow;
  setIdx: number;
  onChange: (s: TrainingSetRow) => void;
  onDelete: () => void;
  CARD: string; BORD: string; TX: string; MT: string;
}) {
  const inp = (val: number | null, onCh: (v: number | null) => void, placeholder: string, color?: string) => (
    <TextInput
      value={val != null && val !== 0 ? String(val) : ''}
      onChangeText={(t) => {
        const n = parseFloat(t);
        onCh(isNaN(n) ? null : n);
      }}
      placeholder={placeholder}
      placeholderTextColor={MT}
      keyboardType="numeric"
      style={[s.setInput, { borderColor: BORD, color: color ?? TX }]}
    />
  );
  return (
    <View style={s.setRowContainer}>
      <Text style={[s.setNum, { color: MT }]}>#{setIdx + 1}</Text>
      {inp(set.reps || null, (v) => onChange({ ...set, reps: v ?? 0 }), 'Reps')}
      {inp(set.weight || null, (v) => onChange({ ...set, weight: v ?? 0 }), 'lbs')}
      <Pressable onPress={onDelete} style={s.setDelete}>
        <Text style={{ color: '#E07878', fontSize: 15 }}>✕</Text>
      </Pressable>
    </View>
  );
}

function ExerciseCard({
  ex, exIdx, onChange, onDelete, CARD, BORD, TX, MT,
}: {
  ex: DraftExercise; exIdx: number;
  onChange: (e: DraftExercise) => void;
  onDelete: () => void;
  CARD: string; BORD: string; TX: string; MT: string;
}) {
  const addSet = () => onChange({ ...ex, sets: [...ex.sets, emptySet()] });
  const updateSet = (i: number, s: TrainingSetRow) =>
    onChange({ ...ex, sets: ex.sets.map((old, j) => j === i ? s : old) });
  const deleteSet = (i: number) =>
    onChange({ ...ex, sets: ex.sets.filter((_, j) => j !== i) });

  return (
    <View style={[s.exCard, { backgroundColor: CARD, borderColor: BORD }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <TextInput
          value={ex.name}
          onChangeText={(t) => onChange({ ...ex, name: t })}
          placeholder={`Exercise ${exIdx + 1} name`}
          placeholderTextColor={MT}
          style={[s.exNameInput, { borderColor: BORD, color: TX, flex: 1 }]}
        />
        <Pressable onPress={onDelete} style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ color: '#E07878', fontSize: 13, fontFamily: 'DMSans_500Medium' }}>Remove</Text>
        </Pressable>
      </View>

      {/* Set header labels */}
      <View style={s.setHeader}>
        <Text style={[s.setHeaderLbl, { color: MT, marginLeft: 28 }]}>Reps</Text>
        <Text style={[s.setHeaderLbl, { color: MT }]}>Weight</Text>
        <View style={{ width: 28 }}/>
      </View>

      {ex.sets.map((set, i) => (
        <SetRow key={i} set={set} setIdx={i} onChange={(s) => updateSet(i, s)}
          onDelete={() => deleteSet(i)} CARD={CARD} BORD={BORD} TX={TX} MT={MT}/>
      ))}

      <Pressable onPress={addSet} style={s.addSetBtn}>
        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: GOLD }}>+ Add Set</Text>
      </Pressable>
    </View>
  );
}

// ── screen ────────────────────────────────────────────────────────────────────
export default function LogWorkoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { tokens, resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';
  const TX   = tokens.colors.text;
  const MT   = tokens.colors.textMuted;
  const CARD = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.88)';
  const BORD = isDark ? 'rgba(191,141,54,0.22)'  : 'rgba(191,141,54,0.18)';
  const BG   = tokens.colors.background;

  const [workoutDate, setWorkoutDate] = useState(todayStr());
  const [muscleFocus, setMuscleFocus] = useState<string>('full_body');
  const [duration, setDuration] = useState('');
  const [exercises, setExercises] = useState<DraftExercise[]>([emptyExercise()]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const updateExercise = useCallback((i: number, ex: DraftExercise) =>
    setExercises((prev) => prev.map((e, j) => j === i ? ex : e)), []);

  const deleteExercise = useCallback((i: number) =>
    setExercises((prev) => prev.filter((_, j) => j !== i)), []);

  const save = async () => {
    const validExercises = exercises.filter((e) => e.name.trim().length > 0);
    if (validExercises.length === 0) {
      Alert.alert('Add an exercise', 'Enter at least one exercise name.');
      return;
    }
    setSaving(true);
    try {
      const patientId = await fetchPatientIdForAuthUser(user?.id ?? '');
      if (!patientId) { Alert.alert('Error', 'Patient profile not found.'); return; }
      const trainingExercises: TrainingExercise[] = validExercises.map((e) => ({
        name: e.name.trim(),
        set_rows: e.sets,
      }));
      const dur = parseInt(duration, 10);
      const { error } = await insertTrainingLog({
        patientId,
        workout_date: workoutDate,
        muscle_focus: muscleFocus,
        exercises: trainingExercises,
        duration_minutes: isNaN(dur) ? null : dur,
        notes: notes.trim() || null,
        weight_unit: 'lb',
      });
      if (error) {
        Alert.alert('Save failed', error);
        return;
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, paddingTop: 8 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* Date */}
        <View style={[s.field, { backgroundColor: CARD, borderColor: BORD }]}>
          <Text style={[s.fieldLabel, { color: MT }]}>DATE</Text>
          <TextInput
            value={workoutDate}
            onChangeText={setWorkoutDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={MT}
            style={[s.fieldInput, { color: TX }]}
            keyboardType="numeric"
          />
        </View>

        {/* Duration */}
        <View style={[s.field, { backgroundColor: CARD, borderColor: BORD }]}>
          <Text style={[s.fieldLabel, { color: MT }]}>DURATION (MINUTES)</Text>
          <TextInput
            value={duration}
            onChangeText={setDuration}
            placeholder="e.g. 45"
            placeholderTextColor={MT}
            style={[s.fieldInput, { color: TX }]}
            keyboardType="numeric"
          />
        </View>

        {/* Muscle focus */}
        <Text style={[s.sectionLabel, { color: MT }]}>MUSCLE FOCUS</Text>
        <View style={s.focusChips}>
          {MUSCLE_FOCUS_OPTIONS.map((opt) => (
            <Pressable
              key={opt.id}
              onPress={() => setMuscleFocus(opt.id)}
              style={[s.chip, {
                backgroundColor: muscleFocus === opt.id ? GOLD : CARD,
                borderColor: muscleFocus === opt.id ? GOLD : BORD,
              }]}>
              <Text style={[s.chipTxt, { color: muscleFocus === opt.id ? '#fff' : TX }]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Exercises */}
        <Text style={[s.sectionLabel, { color: MT, marginTop: 16 }]}>EXERCISES</Text>
        {exercises.map((ex, i) => (
          <ExerciseCard
            key={i}
            ex={ex}
            exIdx={i}
            onChange={(e) => updateExercise(i, e)}
            onDelete={() => deleteExercise(i)}
            CARD={CARD}
            BORD={BORD}
            TX={TX}
            MT={MT}
          />
        ))}
        <Pressable
          onPress={() => setExercises((p) => [...p, emptyExercise()])}
          style={[s.addExBtn, { backgroundColor: CARD, borderColor: BORD }]}>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: GOLD }}>+ Add Exercise</Text>
        </Pressable>

        {/* Notes */}
        <Text style={[s.sectionLabel, { color: MT, marginTop: 16 }]}>NOTES (OPTIONAL)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="How did it feel? Any PRs?"
          placeholderTextColor={MT}
          multiline
          numberOfLines={3}
          style={[s.notesInput, { backgroundColor: CARD, borderColor: BORD, color: TX }]}
        />

        {/* Save */}
        <Pressable
          onPress={() => void save()}
          disabled={saving}
          style={[s.saveBtn, saving && { opacity: 0.6 }]}>
          <Text style={s.saveTxt}>{saving ? 'Saving…' : 'Log Workout'}</Text>
        </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  sectionLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: 8,
    marginTop: 4,
  },
  field: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  fieldLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 9,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  fieldInput: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
  },
  focusChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipTxt: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
  },
  exCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#3d2b1a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  exNameInput: {
    borderBottomWidth: 1,
    paddingVertical: 6,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
  },
  setHeader: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  setHeaderLbl: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 10,
    letterSpacing: 0.8,
    flex: 1,
    textAlign: 'center',
  },
  setRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  setNum: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    width: 24,
    textAlign: 'center',
  },
  setInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    textAlign: 'center',
  },
  setDelete: {
    width: 28,
    alignItems: 'center',
  },
  addSetBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  addExBtn: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 4,
  },
  notesInput: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  saveBtn: {
    backgroundColor: GOLD,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  saveTxt: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
    color: '#fff',
    letterSpacing: 0.5,
  },
});
