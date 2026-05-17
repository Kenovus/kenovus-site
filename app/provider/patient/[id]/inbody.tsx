import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, typography } from '@/constants/designSystem';
import { listInBodyScansForPatientId } from '@/lib/inbody';

export default function PatientInbody() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<
    Array<{
      id: string;
      scan_date: string;
      weight_lbs: number | null;
      body_fat_percent: number | null;
      skeletal_muscle_lbs: number | null;
      bmi: number | null;
      notes: string | null;
      provider_reviewed: boolean;
    }>
  >([]);
  const patientId = String(id ?? '');

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const { rows: scans } = await listInBodyScansForPatientId(patientId);
      setRows(scans);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const trend = useMemo(() => {
    if (rows.length < 2) return null;
    const latest = rows[0];
    const prior = rows[1];
    return {
      weight:
        latest.weight_lbs != null && prior.weight_lbs != null ? latest.weight_lbs - prior.weight_lbs : null,
      bodyFat:
        latest.body_fat_percent != null && prior.body_fat_percent != null
          ? latest.body_fat_percent - prior.body_fat_percent
          : null,
      muscle:
        latest.skeletal_muscle_lbs != null && prior.skeletal_muscle_lbs != null
          ? latest.skeletal_muscle_lbs - prior.skeletal_muscle_lbs
          : null,
    };
  }, [rows]);

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 28, paddingHorizontal: 20 }}>
      <Text style={styles.title}>InBody (provider)</Text>
      <Text style={styles.subtitle}>Patient {patientId}</Text>

      <View style={styles.card}>
        <Text style={styles.section}>Trend summary</Text>
        {trend ? (
          <>
            <Text style={styles.meta}>
              Weight vs prior: {trend.weight == null ? '—' : `${trend.weight > 0 ? '+' : ''}${trend.weight.toFixed(1)} lb`}
            </Text>
            <Text style={styles.meta}>
              Body fat vs prior: {trend.bodyFat == null ? '—' : `${trend.bodyFat > 0 ? '+' : ''}${trend.bodyFat.toFixed(1)}%`}
            </Text>
            <Text style={styles.meta}>
              Muscle vs prior: {trend.muscle == null ? '—' : `${trend.muscle > 0 ? '+' : ''}${trend.muscle.toFixed(1)} lb`}
            </Text>
          </>
        ) : (
          <Text style={styles.meta}>At least two scans needed.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Scan history</Text>
        {loading ? <Text style={styles.meta}>Loading...</Text> : null}
        {rows.map((r) => (
          <View key={r.id} style={styles.row}>
            <Text style={styles.rowMain}>
              {r.scan_date} {r.provider_reviewed ? '· reviewed' : ''}
            </Text>
            <Text style={styles.rowSub}>
              {r.weight_lbs ?? '—'} lb · {r.body_fat_percent ?? '—'}% fat · {r.skeletal_muscle_lbs ?? '—'} lb muscle · BMI{' '}
              {r.bmi ?? '—'}
            </Text>
            {r.notes ? <Text style={styles.notes}>{r.notes}</Text> : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.dark },
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
  meta: { ...typography.body, color: colors.gray1, fontSize: 13 },
  row: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.goldDim },
  rowMain: { ...typography.body, color: colors.white },
  rowSub: { ...typography.body, color: colors.gray1, fontSize: 13, marginTop: 4 },
  notes: { ...typography.body, color: colors.gray2, fontSize: 12, marginTop: 4 },
});
