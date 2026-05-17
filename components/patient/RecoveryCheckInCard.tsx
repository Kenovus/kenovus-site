import { useCallback, useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { localDateKey } from '@/lib/patientSupplements';
import { fetchRecoveryLogForDate, SORENESS_GROUPS, upsertRecoveryLog } from '@/lib/recoveryLogs';

type Props = {
  authUserId: string;
};

export function RecoveryCheckInCard({ authUserId }: Props) {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [sleep, setSleep] = useState('');
  const [sore, setSore] = useState('');
  const [energy, setEnergy] = useState('');
  const [stress, setStress] = useState('');
  const [groups, setGroups] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const today = localDateKey(new Date());

  const load = useCallback(async () => {
    const pid = await fetchPatientIdForAuthUser(authUserId);
    setPatientId(pid);
    if (!pid) {
      setLoaded(true);
      return;
    }
    const row = await fetchRecoveryLogForDate(pid, today);
    if (row) {
      setSleep(row.sleep_hours != null ? String(row.sleep_hours) : '');
      setSore(row.soreness_level != null ? String(row.soreness_level) : '');
      setEnergy(row.energy_level != null ? String(row.energy_level) : '');
      setStress(row.stress_level != null ? String(row.stress_level) : '');
      setGroups(row.soreness_muscle_groups ?? []);
    }
    setLoaded(true);
  }, [authUserId, today]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleGroup = (g: string) => {
    setGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };

  const save = async () => {
    if (!patientId) return;
    setBusy(true);
    try {
      const sh = sleep.trim() ? Number.parseFloat(sleep) : null;
      const sl = sore.trim() ? Number.parseInt(sore, 10) : null;
      const en = energy.trim() ? Number.parseInt(energy, 10) : null;
      const st = stress.trim() ? Number.parseInt(stress, 10) : null;
      const { error } = await upsertRecoveryLog({
        patientId,
        logDate: today,
        sleep_hours: sh != null && Number.isFinite(sh) ? sh : null,
        soreness_level: sl != null && sl >= 1 && sl <= 5 ? sl : null,
        soreness_muscle_groups: groups,
        energy_level: en != null && en >= 1 && en <= 5 ? en : null,
        stress_level: st != null && st >= 1 && st <= 5 ? st : null,
      });
      if (error) {
        console.warn('[recovery]', error);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return null;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled">
    <View style={styles.card}>
      <Text style={styles.title}>Recovery check-in</Text>
      <Text style={styles.meta}>Sleep (hours), soreness 1–5, energy 1–5, stress 1–5 — helps your coach tune volume.</Text>

      <Text style={styles.label}>Sleep hours</Text>
      <TextInput
        value={sleep}
        onChangeText={setSleep}
        placeholder="e.g. 7.5"
        placeholderTextColor={colors.gray2}
        keyboardType="decimal-pad"
        style={styles.input}
        returnKeyType="done"
        blurOnSubmit
        onSubmitEditing={() => Keyboard.dismiss()}
      />

      <Text style={styles.label}>Muscle soreness (1–5)</Text>
      <TextInput
        value={sore}
        onChangeText={setSore}
        placeholder="1 = none, 5 = very sore"
        placeholderTextColor={colors.gray2}
        keyboardType="number-pad"
        style={styles.input}
        returnKeyType="done"
        blurOnSubmit
        onSubmitEditing={() => Keyboard.dismiss()}
      />

      <Text style={styles.label}>Where?</Text>
      <View style={styles.wrap}>
        {SORENESS_GROUPS.map((g) => {
          const on = groups.includes(g);
          return (
            <Pressable key={g} onPress={() => toggleGroup(g)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{g}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Energy (1–5)</Text>
      <TextInput
        value={energy}
        onChangeText={setEnergy}
        keyboardType="number-pad"
        style={styles.input}
        returnKeyType="done"
        blurOnSubmit
        onSubmitEditing={() => Keyboard.dismiss()}
      />

      <Text style={styles.label}>Stress (1–5)</Text>
      <TextInput
        value={stress}
        onChangeText={setStress}
        keyboardType="number-pad"
        style={styles.input}
        returnKeyType="done"
        blurOnSubmit
        onSubmitEditing={() => Keyboard.dismiss()}
      />

      <Button variant="primary" loading={busy} onPress={() => void save()} style={styles.btn}>
        Save recovery
      </Button>
    </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.goldDim,
    padding: 14,
    backgroundColor: colors.darkCard,
  },
  title: { ...typography.body, color: colors.white, fontWeight: '600', marginBottom: 6 },
  meta: { ...typography.body, color: colors.gray2, fontSize: 13, marginBottom: 10 },
  label: { ...typography.label, color: colors.gold, marginTop: 8, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.white,
    ...typography.body,
    backgroundColor: colors.dark2,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  chipOn: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.12)' },
  chipText: { color: colors.gray1, fontSize: 13 },
  chipTextOn: { color: colors.goldLight },
  btn: { marginTop: 12 },
});
