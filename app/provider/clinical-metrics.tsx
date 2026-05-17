import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { fetchClinicalMetricsAggregate, type ClinicalMetricRow } from '@/lib/clinicalMetrics';

export default function ProviderClinicalMetrics() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [row, setRow] = useState<ClinicalMetricRow | null>(null);

  useEffect(() => {
    void (async () => {
      const rows = await fetchClinicalMetricsAggregate(profile?.clinic_id ?? null);
      setRow(rows[0] ?? null);
    })();
  }, [profile?.clinic_id]);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 30, paddingHorizontal: 20 }}>
      <Text style={styles.title}>Clinical Metrics</Text>
      <Text style={styles.sub}>Clinic-level aggregate metrics only (de-identified).</Text>
      <Metric label="Avg weight loss / week" value={row?.avg_weight_loss_lbs_per_week != null ? `${row.avg_weight_loss_lbs_per_week.toFixed(2)} lb` : '—'} />
      <Metric label="% hitting protein goal" value={row?.avg_protein_hit_rate != null ? `${Math.round(row.avg_protein_hit_rate * 100)}%` : '—'} />
      <Metric label="Inactive rate (7+ days)" value={row?.inactive_rate_7d != null ? `${Math.round(row.inactive_rate_7d * 100)}%` : '—'} />
      <Metric label="Workout sessions / week" value={row?.avg_workout_sessions_per_week != null ? row.avg_workout_sessions_per_week.toFixed(2) : '—'} />
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
  title: { ...typography.h2, color: colors.white, marginBottom: 6 },
  sub: { ...typography.body, color: colors.gray1, marginBottom: 12 },
  card: { borderWidth: 1, borderColor: colors.goldDim, borderRadius: 12, padding: 12, backgroundColor: colors.darkCard, marginBottom: 10 },
  label: { ...typography.body, color: colors.gray2, fontSize: 13 },
  value: { ...typography.h2, color: colors.white, fontSize: 24 },
});
