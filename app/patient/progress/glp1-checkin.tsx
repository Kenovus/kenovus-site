import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConsumerPaywallCard } from '@/components/patient/ConsumerPaywallCard';
import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { canUseGlp1PatientFeatures } from '@/lib/consumerTier';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { supabase } from '@/lib/supabase';

type SymptomKey =
  | 'nausea'
  | 'vomiting'
  | 'fatigue'
  | 'constipation'
  | 'diarrhea'
  | 'appetite'
  | 'headache'
  | 'injection_site_reaction';

const SYMPTOMS: { key: SymptomKey; label: string }[] = [
  { key: 'nausea', label: 'Nausea' },
  { key: 'vomiting', label: 'Vomiting' },
  { key: 'fatigue', label: 'Fatigue' },
  { key: 'constipation', label: 'Constipation' },
  { key: 'diarrhea', label: 'Diarrhea' },
  { key: 'appetite', label: 'Appetite change' },
  { key: 'headache', label: 'Headache' },
  { key: 'injection_site_reaction', label: 'Injection site' },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function Stepper(props: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max: number;
}) {
  const min = props.min ?? 0;
  return (
    <View style={styles.stepRow}>
      <Text style={styles.stepLabel}>{props.label}</Text>
      <View style={styles.stepBtns}>
        <Pressable
          onPress={() => props.onChange(Math.max(min, props.value - 1))}
          style={styles.stepBtn}
          hitSlop={8}>
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Text style={styles.stepVal}>
          {props.value}/{props.max}
        </Text>
        <Pressable
          onPress={() => props.onChange(Math.min(props.max, props.value + 1))}
          style={styles.stepBtn}
          hitSlop={8}>
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function Glp1CheckinScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const allowed = canUseGlp1PatientFeatures(profile);
  const [checkinDate, setCheckinDate] = useState(todayIso);
  const [symptoms, setSymptoms] = useState<Record<SymptomKey, number>>({
    nausea: 0,
    vomiting: 0,
    fatigue: 0,
    constipation: 0,
    diarrhea: 0,
    appetite: 0,
    headache: 0,
    injection_site_reaction: 0,
  });
  const [overallFeeling, setOverallFeeling] = useState(3);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user || !allowed) return;
    setLoading(true);
    try {
      const pid = await fetchPatientIdForAuthUser(user.id);
      if (!pid) return;
      const { data, error } = await supabase
        .from('glp1_checkins')
        .select('*')
        .eq('patient_id', pid)
        .eq('checkin_date', checkinDate)
        .maybeSingle();
      if (error) {
        console.warn('[glp1 checkin]', error.message);
        return;
      }
      if (!data) {
        setSymptoms({
          nausea: 0,
          vomiting: 0,
          fatigue: 0,
          constipation: 0,
          diarrhea: 0,
          appetite: 0,
          headache: 0,
          injection_site_reaction: 0,
        });
        setOverallFeeling(3);
        setNotes('');
        return;
      }
      setSymptoms({
        nausea: Number(data.nausea ?? 0),
        vomiting: Number(data.vomiting ?? 0),
        fatigue: Number(data.fatigue ?? 0),
        constipation: Number(data.constipation ?? 0),
        diarrhea: Number(data.diarrhea ?? 0),
        appetite: Number(data.appetite ?? 0),
        headache: Number(data.headache ?? 0),
        injection_site_reaction: Number(data.injection_site_reaction ?? 0),
      });
      setOverallFeeling(Math.min(5, Math.max(1, Number(data.overall_feeling ?? 3))));
      setNotes(String(data.notes ?? ''));
    } finally {
      setLoading(false);
    }
  }, [user, allowed, checkinDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const payload = useMemo(
    () => ({
      checkin_date: checkinDate,
      ...symptoms,
      overall_feeling: overallFeeling,
      notes: notes.trim() || null,
    }),
    [checkinDate, symptoms, overallFeeling, notes],
  );

  const shiftDate = (delta: number) => {
    const d = new Date(`${checkinDate}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    setCheckinDate(d.toISOString().slice(0, 10));
  };

  const save = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const pid = await fetchPatientIdForAuthUser(user.id);
      if (!pid) {
        Alert.alert('Setup', 'Patient profile not found.');
        return;
      }
      const { error } = await supabase.from('glp1_checkins').upsert(
        { patient_id: pid, ...payload },
        { onConflict: 'patient_id,checkin_date' },
      );
      if (error) {
        Alert.alert('Save failed', error.message);
        return;
      }
      Alert.alert('Saved', `Check-in stored for ${checkinDate}.`);
    } finally {
      setBusy(false);
    }
  };

  if (!allowed) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 16, paddingHorizontal: 20 }]}>
        <Text style={styles.title}>GLP-1 check-in</Text>
        <ConsumerPaywallCard
          title="GLP-1 tools need GLP-1+ or clinic access"
          body="Symptom check-ins and injection-aware tasks are included for GLP-1+ consumers and clinic-managed GLP-1 patients."
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={88}>
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 40, paddingHorizontal: 20 }}>
      <Text style={styles.title}>GLP-1 check-in</Text>
      <Text style={styles.sub}>0 = none, 5 = severe. Overall feeling is 1–5 (higher is better).</Text>

      <View style={styles.dateRow}>
        <Pressable onPress={() => shiftDate(-1)} style={styles.dateBtn}>
          <Text style={styles.dateBtnText}>◀</Text>
        </Pressable>
        <Text style={styles.dateText}>{checkinDate}</Text>
        <Pressable onPress={() => shiftDate(1)} style={styles.dateBtn}>
          <Text style={styles.dateBtnText}>▶</Text>
        </Pressable>
      </View>
      {loading ? <Text style={styles.meta}>Loading day…</Text> : null}

      {SYMPTOMS.map((s) => (
        <Stepper
          key={s.key}
          label={s.label}
          value={symptoms[s.key]}
          max={5}
          onChange={(n) => setSymptoms((prev) => ({ ...prev, [s.key]: n }))}
        />
      ))}

      <Text style={styles.label}>Overall feeling (1–5)</Text>
      <Stepper label="Mood / stability" value={overallFeeling} min={1} max={5} onChange={setOverallFeeling} />

      <Text style={styles.label}>Notes for your team</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional context"
        placeholderTextColor={colors.gray2}
        multiline
        style={styles.notes}
      />

      <Button loading={busy} onPress={() => void save()} variant="primary">
        Save check-in
      </Button>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  title: { ...typography.h2, color: colors.white, marginBottom: 6 },
  sub: { ...typography.body, color: colors.gray1, marginBottom: 14, lineHeight: 22 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 12 },
  dateBtn: { padding: 10 },
  dateBtnText: { ...typography.body, color: colors.gold, fontSize: 18 },
  dateText: { ...typography.body, color: colors.white, fontSize: 16 },
  meta: { ...typography.body, color: colors.gray2, marginBottom: 10 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.goldDim,
  },
  stepLabel: { ...typography.body, color: colors.white, flex: 1, paddingRight: 12 },
  stepBtns: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkCard,
  },
  stepBtnText: { color: colors.gold, fontSize: 20, lineHeight: 22 },
  stepVal: { ...typography.body, color: colors.goldLight, minWidth: 52, textAlign: 'center' },
  label: { ...typography.label, color: colors.goldLight, marginTop: 18, marginBottom: 8 },
  notes: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 12,
    padding: 12,
    color: colors.white,
    ...typography.body,
    backgroundColor: colors.darkCard,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
});
