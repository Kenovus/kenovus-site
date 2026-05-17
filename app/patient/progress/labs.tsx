import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { createLabResultForAuthUser, listLabResultsForAuthUser } from '@/lib/patientLabs';

export default function ProgressLabs() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<
    Array<{
      id: string;
      lab_date: string;
      panel_name: string | null;
      hba1c: number | null;
      total_cholesterol: number | null;
      ldl: number | null;
      hdl: number | null;
      triglycerides: number | null;
      provider_notes: string | null;
    }>
  >([]);

  const [labDate, setLabDate] = useState(new Date().toISOString().slice(0, 10));
  const [cmpNotes, setCmpNotes] = useState('');
  const [a1c, setA1c] = useState('');
  const [totalChol, setTotalChol] = useState('');
  const [ldl, setLdl] = useState('');
  const [hdl, setHdl] = useState('');
  const [trig, setTrig] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { rows: list, error } = await listLabResultsForAuthUser(user.id);
      if (error) {
        Alert.alert('Labs', error.message);
        return;
      }
      setRows(list);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await createLabResultForAuthUser({
        authUserId: user.id,
        lab_date: labDate,
        panel_name: 'CMP',
        provider_notes: cmpNotes.trim() || null,
        hba1c: a1c ? Number(a1c) : null,
        total_cholesterol: totalChol ? Number(totalChol) : null,
        ldl: ldl ? Number(ldl) : null,
        hdl: hdl ? Number(hdl) : null,
        triglycerides: trig ? Number(trig) : null,
      });
      if (error) {
        Alert.alert('Labs', error.message);
        return;
      }
      setCmpNotes('');
      setA1c('');
      setTotalChol('');
      setLdl('');
      setHdl('');
      setTrig('');
      Alert.alert('Saved', 'Lab entry saved.');
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 28, paddingHorizontal: 20 }}>
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Labs</Text>
      <Text style={styles.subtitle}>Manual lab entry. Share results with your provider during visits.</Text>

      <View style={styles.card}>
        <Field label="Date (YYYY-MM-DD)" value={labDate} onChangeText={setLabDate} />
        <Field label="CMP notes" value={cmpNotes} onChangeText={setCmpNotes} multiline />
        <Field label="A1C (%)" value={a1c} onChangeText={setA1c} keyboardType="decimal-pad" />
        <Field label="Total cholesterol" value={totalChol} onChangeText={setTotalChol} keyboardType="decimal-pad" />
        <Field label="LDL" value={ldl} onChangeText={setLdl} keyboardType="decimal-pad" />
        <Field label="HDL" value={hdl} onChangeText={setHdl} keyboardType="decimal-pad" />
        <Field label="Triglycerides" value={trig} onChangeText={setTrig} keyboardType="decimal-pad" />
        <Button variant="primary" loading={busy} onPress={() => void save()}>
          Save lab entry
        </Button>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>History</Text>
        {loading ? <Text style={styles.meta}>Loading...</Text> : null}
        {rows.map((r) => (
          <View key={r.id} style={styles.row}>
            <Text style={styles.rowMain}>{r.lab_date}</Text>
            <Text style={styles.rowSub}>
              A1C {r.hba1c ?? '—'}% · TC {r.total_cholesterol ?? '—'} · LDL {r.ldl ?? '—'} · HDL {r.hdl ?? '—'} · TG{' '}
              {r.triglycerides ?? '—'}
            </Text>
            {r.provider_notes ? <Text style={styles.rowNotes}>{r.provider_notes}</Text> : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.label}
        placeholderTextColor={colors.gray2}
        keyboardType={props.keyboardType}
        multiline={props.multiline}
        style={[styles.input, props.multiline && styles.inputMulti]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.dark },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 6 },
  backText: { ...typography.body, color: colors.gold, fontSize: 16 },
  title: { ...typography.h2, color: colors.white, marginBottom: 6 },
  subtitle: { ...typography.body, color: colors.gray1, marginBottom: 14 },
  card: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.darkCard,
    marginBottom: 12,
  },
  section: { ...typography.label, color: colors.goldLight, marginBottom: 8 },
  field: { marginBottom: 8 },
  fieldLabel: { ...typography.label, color: colors.gold, marginBottom: 6, fontSize: 11 },
  input: {
    ...typography.body,
    color: colors.white,
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: colors.dark2,
  },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
  meta: { ...typography.body, color: colors.gray1, fontSize: 13 },
  row: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.goldDim },
  rowMain: { ...typography.body, color: colors.white },
  rowSub: { ...typography.body, color: colors.gray1, fontSize: 13, marginTop: 4 },
  rowNotes: { ...typography.body, color: colors.gray2, fontSize: 12, marginTop: 4 },
});
