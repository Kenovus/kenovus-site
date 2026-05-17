import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, typography } from '@/constants/designSystem';
import { fetchClinicalMetricsAggregate, type ClinicalMetricRow } from '@/lib/clinicalMetrics';

function pct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${Math.round(n * 100)}%`;
}

export default function AdminClinicalMetrics() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [rows, setRows] = useState<ClinicalMetricRow[]>([]);

  useEffect(() => {
    void (async () => setRows(await fetchClinicalMetricsAggregate()))();
  }, []);

  const aggregate = rows.reduce(
    (a, r) => ({
      patients: a.patients + Number(r.patients_count ?? 0),
      weight: a.weight + Number(r.avg_weight_loss_lbs_per_week ?? 0),
      bf: a.bf + Number(r.avg_body_fat_percent ?? 0),
      lean: a.lean + Number(r.avg_lean_mass_lbs ?? 0),
      protein: a.protein + Number(r.avg_protein_hit_rate ?? 0),
      inactive: a.inactive + Number(r.inactive_rate_7d ?? 0),
      supp: a.supp + Number(r.avg_supplement_consistency ?? 0),
      workouts: a.workouts + Number(r.avg_workout_sessions_per_week ?? 0),
      n: a.n + 1,
    }),
    { patients: 0, weight: 0, bf: 0, lean: 0, protein: 0, inactive: 0, supp: 0, workouts: 0, n: 0 },
  );
  const n = Math.max(1, aggregate.n);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 30, paddingHorizontal: 20 }}>
      <Text onPress={() => router.back()} style={styles.backText}>← Back</Text>
      <Text style={styles.title}>Clinical Metrics</Text>
      <Text style={styles.sub}>Aggregate and de-identified GLP-1 / wellness performance only.</Text>
      <Metric label="Avg weight loss / week" value={`${(aggregate.weight / n).toFixed(2)} lb`} />
      <Metric label="Avg body fat %" value={`${(aggregate.bf / n).toFixed(1)}%`} />
      <Metric label="Avg lean mass" value={`${(aggregate.lean / n).toFixed(1)} lb`} />
      <Metric label="% hitting protein goal" value={pct(aggregate.protein / n)} />
      <Metric label="Inactive rate (7+ days)" value={pct(aggregate.inactive / n)} />
      <Metric label="Supplement consistency" value={pct(aggregate.supp / n)} />
      <Metric label="Workout sessions / week" value={`${(aggregate.workouts / n).toFixed(2)}`} />
      <Metric label="Patients included" value={String(aggregate.patients)} />
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.dark },
  backText: { ...typography.body, color: colors.gold, fontSize: 16, marginBottom: 6 },
  title: { ...typography.h2, color: colors.white, marginBottom: 6 },
  sub: { ...typography.body, color: colors.gray1, marginBottom: 12 },
  card: { borderWidth: 1, borderColor: colors.goldDim, borderRadius: 12, padding: 12, backgroundColor: colors.darkCard, marginBottom: 10 },
  label: { ...typography.body, color: colors.gray2, fontSize: 13 },
  value: { ...typography.h2, color: colors.white, fontSize: 28 },
});
