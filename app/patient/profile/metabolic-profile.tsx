import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import {
  ACTIVITY_LEVEL_LABELS,
  ACTIVITY_LEVEL_ORDER,
  type ActivityLevelId,
  type BiologicalSexForBmr,
} from '@/lib/nutritionMacroTargets';
import {
  fetchPatientMetabolicRow,
  updatePatientMetabolicFields,
  recomputeAndPersistPatientTdee,
} from '@/lib/patientMetabolicProfile';
import { formatDigitsToMmDdYyyy, isoYmdToMmDdYyyy, parseMmDdYyyyToIso } from '@/lib/dateUsFormat';
import { standardTextInputProps } from '@/lib/textInputStandard';

export default function MetabolicProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [dob, setDob] = useState('');
  const [dobIso, setDobIso] = useState<string | null>(null);
  const [heightFt, setHeightFt] = useState('');
  const [heightInPart, setHeightInPart] = useState('');
  const [age, setAge] = useState('');
  const [bioSex, setBioSex] = useState<BiologicalSexForBmr | null>(null);
  const [activity, setActivity] = useState<ActivityLevelId | null>(null);
  const [tdee, setTdee] = useState<number | null>(null);

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
      const row = await fetchPatientMetabolicRow(pid);
      if (row) {
        if (row.date_of_birth) {
          setDob(isoYmdToMmDdYyyy(row.date_of_birth));
          setDobIso(row.date_of_birth);
        } else {
          setDob('');
          setDobIso(null);
        }
        if (row.height_inches != null) {
          const total = Math.round(Number(row.height_inches));
          setHeightFt(String(Math.floor(total / 12)));
          setHeightInPart(String(total % 12));
        } else {
          setHeightFt('');
          setHeightInPart('');
        }
        setAge(row.age != null ? String(row.age) : '');
        setBioSex(row.biological_sex);
        setActivity(row.activity_level);
        setTdee(row.tdee_kcal);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!patientId) return;
    setSaving(true);
    try {
      const ageN = age.trim() ? Number.parseInt(age, 10) : null;
      const ft = heightFt.trim() ? Number.parseInt(heightFt, 10) : 0;
      const inch = heightInPart.trim() ? Number.parseInt(heightInPart, 10) : 0;
      const heightTotalIn =
        heightFt.trim() || heightInPart.trim() ? Math.min(96, Math.max(36, ft * 12 + inch)) : null;
      const dobOut = parseMmDdYyyyToIso(dob.trim()) ?? dobIso;
      const { error } = await updatePatientMetabolicFields(patientId, {
        date_of_birth: dobOut || null,
        height_inches: heightTotalIn,
        biological_sex: bioSex,
        age: ageN != null && Number.isFinite(ageN) ? ageN : null,
        activity_level: activity,
      });
      if (error) {
        Alert.alert('Could not save', error);
        return;
      }
      const { tdee: td, error: e2 } = await recomputeAndPersistPatientTdee(patientId);
      if (e2) console.warn('[metabolic-profile] tdee', e2);
      setTdee(td ?? null);
      Alert.alert('Saved', td != null ? `Maintenance TDEE updated to ~${Math.round(td)} kcal.` : 'Profile saved. Add missing fields to compute TDEE.');
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
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top + 8}>
      <ScrollView
        style={styles.screen}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 20,
        }}>
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Metabolic profile</Text>
      <Text style={styles.sub}>
        Used for Mifflin–St Jeor TDEE and prescribed macros. You can use date of birth or a direct age — if both are set,
        age field wins for BMR.
      </Text>
      {tdee != null ? (
        <Text style={styles.tdee}>Stored maintenance TDEE: ~{Math.round(tdee)} kcal</Text>
      ) : null}

      <Text style={styles.label}>Date of birth (MM-DD-YYYY)</Text>
      <TextInput
        value={dob}
        onChangeText={(t) => {
          const f = formatDigitsToMmDdYyyy(t);
          setDob(f);
          setDobIso(parseMmDdYyyyToIso(f));
        }}
        placeholder="01-15-1990"
        placeholderTextColor={colors.gray2}
        style={styles.input}
        autoCapitalize="none"
        keyboardType="number-pad"
        {...standardTextInputProps({ onSubmit: () => Keyboard.dismiss() })}
      />

      <Text style={styles.label}>Age (optional if DOB set)</Text>
      <TextInput
        value={age}
        onChangeText={setAge}
        keyboardType="number-pad"
        placeholder="e.g. 42"
        placeholderTextColor={colors.gray2}
        style={styles.input}
        {...standardTextInputProps({ onSubmit: () => Keyboard.dismiss() })}
      />

      <Text style={styles.label}>Height</Text>
      <View style={styles.heightRow}>
        <TextInput
          value={heightFt}
          onChangeText={setHeightFt}
          keyboardType="number-pad"
          placeholder="5"
          placeholderTextColor={colors.gray2}
          style={[styles.input, styles.heightField]}
          {...standardTextInputProps({ onSubmit: () => Keyboard.dismiss() })}
        />
        <Text style={styles.heightSep}>ft</Text>
        <TextInput
          value={heightInPart}
          onChangeText={setHeightInPart}
          keyboardType="number-pad"
          placeholder="11"
          placeholderTextColor={colors.gray2}
          style={[styles.input, styles.heightField]}
          {...standardTextInputProps({ onSubmit: () => Keyboard.dismiss() })}
        />
        <Text style={styles.heightSep}>in</Text>
      </View>

      <Text style={styles.label}>Biological sex (for BMR equation)</Text>
      <View style={styles.row}>
        {(['male', 'female'] as const).map((s) => (
          <Pressable key={s} onPress={() => setBioSex(s)} style={[styles.chip, bioSex === s && styles.chipOn]}>
            <Text style={[styles.chipText, bioSex === s && styles.chipTextOn]}>{s === 'male' ? 'Male' : 'Female'}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Activity level</Text>
      {ACTIVITY_LEVEL_ORDER.map((id) => (
        <Pressable key={id} onPress={() => setActivity(id)} style={[styles.opt, activity === id && styles.optOn]}>
          <Text style={[styles.optText, activity === id && styles.optTextOn]}>{ACTIVITY_LEVEL_LABELS[id]}</Text>
        </Pressable>
      ))}

      <Button variant="primary" loading={saving} onPress={() => void save()} style={styles.save}>
        Save &amp; update TDEE
      </Button>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 6 },
  backText: { ...typography.body, color: colors.gold, fontSize: 16 },
  center: { flex: 1, backgroundColor: colors.dark, alignItems: 'center' },
  title: { ...typography.h2, color: colors.white, marginBottom: 8 },
  sub: { ...typography.body, color: colors.gray1, marginBottom: 12 },
  tdee: { ...typography.body, color: colors.goldLight, marginBottom: 12 },
  label: { ...typography.label, color: colors.gold, marginTop: 12, marginBottom: 6 },
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
  heightRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  heightField: { flex: 1, minWidth: 80 },
  heightSep: { ...typography.body, color: colors.gray1, marginRight: 4 },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: colors.darkCard,
  },
  chipOn: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.12)' },
  chipText: { color: colors.gray1 },
  chipTextOn: { color: colors.goldLight, fontWeight: '600' },
  opt: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    backgroundColor: colors.darkCard,
  },
  optOn: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.1)' },
  optText: { color: colors.white },
  optTextOn: { color: colors.goldLight },
  save: { marginTop: 24 },
});
