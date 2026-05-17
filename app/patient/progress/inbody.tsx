import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { createInBodyScanForAuthUser, listInBodyScansForAuthUser } from '@/lib/inbody';
import { extractInBodyOrDexaWithSona } from '@/lib/inbodyVision';
import { formatDigitsToMmDdYyyy, isoYmdToMmDdYyyy, parseMmDdYyyyToIso } from '@/lib/dateUsFormat';

export default function ProgressInbody() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<
    Array<{
      id: string;
      scan_date: string;
      weight_lbs: number | null;
      body_fat_percent: number | null;
      skeletal_muscle_lbs: number | null;
      bmi: number | null;
      visceral_fat_level: number | null;
      notes: string | null;
    }>
  >([]);

  const [scanDate, setScanDate] = useState(() => isoYmdToMmDdYyyy(new Date().toISOString().slice(0, 10)));
  const [scanDateIso, setScanDateIso] = useState(new Date().toISOString().slice(0, 10));
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [muscle, setMuscle] = useState('');
  const [bmi, setBmi] = useState('');
  const [visceral, setVisceral] = useState('');
  const [notes, setNotes] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractNotice, setExtractNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { rows: scans, error } = await listInBodyScansForAuthUser(user.id);
      if (error) {
        Alert.alert('InBody', error.message);
        return;
      }
      setRows(scans);
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
      const { error } = await createInBodyScanForAuthUser({
        authUserId: user.id,
        scan_date: scanDateIso,
        weight_lbs: weight ? Number(weight) : null,
        body_fat_percent: bodyFat ? Number(bodyFat) : null,
        skeletal_muscle_lbs: muscle ? Number(muscle) : null,
        bmi: bmi ? Number(bmi) : null,
        bmr_kcal: null,
        visceral_fat_level: visceral ? Number(visceral) : null,
        total_body_water_lbs: null,
        notes,
      });
      if (error) {
        Alert.alert('InBody', error.message);
        return;
      }
      setWeight('');
      setBodyFat('');
      setMuscle('');
      setBmi('');
      setVisceral('');
      setNotes('');
      Alert.alert('Saved', 'InBody scan saved.');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const applyExtracted = (x: {
    weight_lbs: number | null;
    body_fat_percent: number | null;
    skeletal_muscle_lbs: number | null;
    bmi: number | null;
    visceral_fat_level: number | null;
    notes: string;
    confidence: number;
  }) => {
    if (x.weight_lbs != null) setWeight(String(x.weight_lbs));
    if (x.body_fat_percent != null) setBodyFat(String(x.body_fat_percent));
    if (x.skeletal_muscle_lbs != null) setMuscle(String(x.skeletal_muscle_lbs));
    if (x.bmi != null) setBmi(String(x.bmi));
    if (x.visceral_fat_level != null) setVisceral(String(x.visceral_fat_level));
    if (x.notes) setNotes(x.notes);
    setExtractNotice(`AI extraction — please verify values match your InBody printout. Confidence ${(x.confidence * 100).toFixed(0)}%`);
  };

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera required', 'Allow camera access to scan report images.');
      return;
    }
    const photo = await ImagePicker.launchCameraAsync({ quality: 0.9, base64: true });
    if (photo.canceled || !photo.assets?.[0]) return;
    const asset = photo.assets[0];
    if (!asset.base64) return;
    setExtracting(true);
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), 20000);
      });
      const { data, error } = (await Promise.race([
        extractInBodyOrDexaWithSona({
          base64: asset.base64,
          mediaType: asset.mimeType ?? 'image/jpeg',
          modality: 'inbody',
        }),
        timeoutPromise,
      ])) as Awaited<ReturnType<typeof extractInBodyOrDexaWithSona>>;
      if (error) Alert.alert('Extraction warning', error.message);
      applyExtracted({
        weight_lbs: data.weight_lbs,
        body_fat_percent: data.body_fat_percent,
        skeletal_muscle_lbs: data.skeletal_muscle_lbs,
        bmi: data.bmi,
        visceral_fat_level: data.visceral_fat_level,
        notes: data.notes,
        confidence: data.confidence,
      });
    } catch {
      Alert.alert("Couldn't extract your InBody data in time. Please enter values manually.");
    } finally {
      setExtracting(false);
    }
  };

  const pickFile = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      multiple: false,
      type: ['application/pdf', 'image/*', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled) return;
    const first = picked.assets?.[0];
    const legacy = picked as { uri?: string; name?: string; mimeType?: string | null };
    const uri = first?.uri ?? legacy.uri;
    if (!uri) return;
    const name = first?.name ?? legacy.name;
    const mime = first?.mimeType ?? legacy.mimeType;
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });
    setExtracting(true);
    try {
      const modality = /dexa/i.test(name ?? '') ? 'dexa' : 'inbody';
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), 20000);
      });
      const { data, error } = (await Promise.race([
        extractInBodyOrDexaWithSona({
          base64,
          mediaType: mime ?? (String(name ?? '').toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
          modality,
        }),
        timeoutPromise,
      ])) as Awaited<ReturnType<typeof extractInBodyOrDexaWithSona>>;
      if (error) Alert.alert('Extraction warning', error.message);
      applyExtracted({
        weight_lbs: data.weight_lbs,
        body_fat_percent: data.body_fat_percent,
        skeletal_muscle_lbs: data.skeletal_muscle_lbs,
        bmi: data.bmi,
        visceral_fat_level: data.visceral_fat_level,
        notes: data.notes,
        confidence: data.confidence,
      });
    } catch {
      Alert.alert("Couldn't extract your InBody data in time. Please enter values manually.");
    } finally {
      setExtracting(false);
    }
  };

  const trend = useMemo(() => {
    if (rows.length < 2) return null;
    const latest = rows[0];
    const prev = rows[1];
    const weightDelta =
      latest.weight_lbs != null && prev.weight_lbs != null ? latest.weight_lbs - prev.weight_lbs : null;
    const bodyFatDelta =
      latest.body_fat_percent != null && prev.body_fat_percent != null
        ? latest.body_fat_percent - prev.body_fat_percent
        : null;
    return { weightDelta, bodyFatDelta };
  }, [rows]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={88}>
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 28, paddingHorizontal: 20 }}>
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>InBody</Text>
      <Text style={styles.subtitle}>Manual entry: date, weight, body fat %, muscle (lb), BMI, visceral fat level.</Text>

      <View style={styles.card}>
        <Text style={styles.section}>Upload InBody Result</Text>
        <Text style={styles.meta}>Upload PDF or image (InBody / DEXA) to auto-populate fields.</Text>
        {extracting ? <Text style={styles.meta}>Extracting your InBody data...</Text> : null}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <Button variant="ghost" onPress={() => void pickFile()} loading={extracting}>
            Upload file
          </Button>
          <Button variant="ghost" onPress={() => void pickFromCamera()} loading={extracting}>
            Camera scan
          </Button>
        </View>
        {extractNotice ? <Text style={styles.warn}>{extractNotice}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Manual entry</Text>
        <Field
          label="Date (MM-DD-YYYY)"
          value={scanDate}
          onChangeText={(t) => {
            const f = formatDigitsToMmDdYyyy(t);
            setScanDate(f);
            const iso = parseMmDdYyyyToIso(f);
            if (iso) setScanDateIso(iso);
          }}
        />
        <Field label="Weight (lb)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
        <Field label="Body fat (%)" value={bodyFat} onChangeText={setBodyFat} keyboardType="decimal-pad" />
        <Field label="Muscle mass (lb)" value={muscle} onChangeText={setMuscle} keyboardType="decimal-pad" />
        <Field label="BMI" value={bmi} onChangeText={setBmi} keyboardType="decimal-pad" />
        <Field label="Visceral fat level" value={visceral} onChangeText={setVisceral} keyboardType="number-pad" />
        <Field label="Notes (optional)" value={notes} onChangeText={setNotes} />
        <Button variant="primary" loading={busy} onPress={() => void save()}>
          Save scan
        </Button>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Trend snapshot</Text>
        {trend ? (
          <>
            <Text style={styles.meta}>
              Weight delta vs prior scan:{' '}
              {trend.weightDelta == null ? '—' : `${trend.weightDelta > 0 ? '+' : ''}${trend.weightDelta.toFixed(1)} lb`}
            </Text>
            <Text style={styles.meta}>
              Body fat delta vs prior scan:{' '}
              {trend.bodyFatDelta == null ? '—' : `${trend.bodyFatDelta > 0 ? '+' : ''}${trend.bodyFatDelta.toFixed(1)}%`}
            </Text>
          </>
        ) : (
          <Text style={styles.meta}>Add at least 2 scans to see deltas.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>History</Text>
        {loading ? <Text style={styles.meta}>Loading...</Text> : null}
        {rows.map((r) => (
          <View key={r.id} style={styles.row}>
            <Text style={styles.rowMain}>{r.scan_date}</Text>
            <Text style={styles.rowSub}>
              {r.weight_lbs ?? '—'} lb · {r.body_fat_percent ?? '—'}% fat · {r.skeletal_muscle_lbs ?? '—'} lb muscle
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.label}
        placeholderTextColor={colors.gray2}
        keyboardType={props.keyboardType}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.dark },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 6 },
  backText: { color: colors.gold, fontSize: 16 },
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
  label: { ...typography.label, color: colors.gold, marginBottom: 6, fontSize: 11 },
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
  meta: { ...typography.body, color: colors.gray1, fontSize: 13 },
  warn: { ...typography.body, color: colors.warning, fontSize: 12, marginBottom: 8 },
  row: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.goldDim },
  rowMain: { ...typography.body, color: colors.white },
  rowSub: { ...typography.body, color: colors.gray1, fontSize: 13, marginTop: 4 },
});
