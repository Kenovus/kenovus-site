import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import {
  TRAINING_PHASE_IDS,
  fetchPatientGoals,
  updatePatientTrainingPhase,
  type TrainingPhaseId,
} from '@/lib/patientGoals';
import { TRAINING_PHASE_LABELS } from '@/lib/phaseDisplay';

export default function TrainingPhaseScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [phase, setPhase] = useState<TrainingPhaseId | null>(null);
  const [started, setStarted] = useState('');
  const [ended, setEnded] = useState('');
  const [macroNotes, setMacroNotes] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const pid = await fetchPatientIdForAuthUser(user.id);
      setPatientId(pid);
      if (!pid) return;
      const row = await fetchPatientGoals(pid);
      if (!row) {
        Alert.alert('My Goals', 'Complete My Goals first so we can attach a training phase.');
        router.back();
        return;
      }
      setPhase(row.training_phase);
      setStarted(row.phase_started_at ?? '');
      setEnded(row.phase_target_end ?? '');
      const notes =
        row.phase_macro_adjustments &&
        typeof row.phase_macro_adjustments === 'object' &&
        'member_notes' in row.phase_macro_adjustments
          ? String((row.phase_macro_adjustments as { member_notes?: string }).member_notes ?? '')
          : '';
      setMacroNotes(notes);
    } finally {
      setLoading(false);
    }
  }, [user?.id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!patientId) return;
    setSaving(true);
    try {
      const { error } = await updatePatientTrainingPhase({
        patientId,
        training_phase: phase,
        phase_started_at: started.trim() || null,
        phase_target_end: ended.trim() || null,
        phase_macro_adjustments: macroNotes.trim() ? { member_notes: macroNotes.trim() } : {},
      });
      if (error) {
        Alert.alert('Could not save', error);
        return;
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.body}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 20,
      }}>
      <Text style={styles.title}>Training phase</Text>
      <Text style={styles.sub}>
        Periodization for your home banner and coach context. Macro notes are reminders for you and your coach only—not
        prescriptions.
      </Text>

      <Text style={styles.label}>Phase</Text>
      <View style={styles.wrap}>
        <Pressable onPress={() => setPhase(null)} style={[styles.chip, phase == null && styles.chipOn]}>
          <Text style={[styles.chipText, phase == null && styles.chipTextOn]}>None</Text>
        </Pressable>
        {TRAINING_PHASE_IDS.map((id) => (
          <Pressable key={id} onPress={() => setPhase(id)} style={[styles.chip, phase === id && styles.chipOn]}>
            <Text style={[styles.chipText, phase === id && styles.chipTextOn]}>{TRAINING_PHASE_LABELS[id]}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Phase start (YYYY-MM-DD)</Text>
      <TextInput
        value={started}
        onChangeText={setStarted}
        placeholder="2026-01-01"
        placeholderTextColor={colors.gray2}
        style={styles.input}
        autoCapitalize="none"
      />

      <Text style={styles.label}>Target phase end (YYYY-MM-DD)</Text>
      <TextInput
        value={ended}
        onChangeText={setEnded}
        placeholder="2026-04-01"
        placeholderTextColor={colors.gray2}
        style={styles.input}
        autoCapitalize="none"
      />

      <Text style={styles.label}>Phase notes (optional)</Text>
      <TextInput
        value={macroNotes}
        onChangeText={setMacroNotes}
        placeholder="e.g. slight carb drop on rest days — coach aware"
        placeholderTextColor={colors.gray2}
        multiline
        style={[styles.input, styles.notes]}
      />

      <Button variant="primary" loading={saving} onPress={() => void save()} style={styles.save}>
        Save phase
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  center: { flex: 1, backgroundColor: colors.dark, alignItems: 'center' },
  title: { ...typography.h2, color: colors.white, marginBottom: 8 },
  sub: { ...typography.body, color: colors.gray1, marginBottom: 16 },
  label: { ...typography.label, color: colors.gold, marginTop: 12, marginBottom: 8 },
  body: { color: colors.gray1 },
  input: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 12,
    padding: 12,
    color: colors.white,
    ...typography.body,
    backgroundColor: colors.dark2,
  },
  notes: { minHeight: 100, textAlignVertical: 'top' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: colors.darkCard,
  },
  chipOn: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.12)' },
  chipText: { color: colors.gray1, fontSize: 14 },
  chipTextOn: { color: colors.goldLight, fontWeight: '600' },
  save: { marginTop: 24 },
});
