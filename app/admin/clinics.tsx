import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdminSection } from '@/components/admin/AdminSection';
import { METRIC_CARD_BORDER, MetricCard } from '@/components/admin/MetricCard';
import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { fetchClinicDirectory } from '@/lib/adminMetrics';
import { generateAndSendClinicRoiReport, fetchLatestClinicRoiReports } from '@/lib/roiReports';
import { useAuth } from '@/hooks/useAuth';

export default function AdminClinicsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [rows, setRows] = useState<Array<{ id: string; name: string; patients: number; mrr: number; engagementRate: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [sendingForClinic, setSendingForClinic] = useState<string | null>(null);
  const [latestReport, setLatestReport] = useState<Record<string, { period_end: string; created_at: string } | undefined>>({});

  const load = useCallback(async () => {
    const { rows: clinicRows, error: loadErr } = await fetchClinicDirectory();
    setRows(clinicRows);
    setError(loadErr ? loadErr.message : null);
    if (clinicRows.length > 0) {
      const map = await fetchLatestClinicRoiReports(clinicRows.map((r) => r.id));
      setLatestReport(map.byClinicId);
    } else {
      setLatestReport({});
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: 30 }]}>
      <Text style={styles.title}>Clinic Directory</Text>
      <Text style={styles.subtitle}>Patient trend, MRR, ROI, AI cost, billing status.</Text>
      {error ? <Text style={styles.error}>Load error: {error}</Text> : null}
      {!error && rows.length === 0 ? <Text style={styles.empty}>No clinics returned from Supabase.</Text> : null}

      <AdminSection title="Directory">
        {rows.map((c) => (
          <View key={c.id} style={styles.clinicCard}>
            <Text style={styles.clinicName}>{c.name}</Text>
            <View style={styles.metricsRow}>
              <MetricCard label="Patients" value={String(c.patients)} confidence="real" />
              <MetricCard label="MRR" value={`$${Math.round(c.mrr).toLocaleString()}`} confidence="real" />
            </View>
            <Text style={styles.meta}>
              Engagement (7d): {(c.engagementRate * 100).toFixed(0)}% · Trial/Billing: Active
            </Text>
            <Text style={styles.meta}>
              Latest ROI report:{' '}
              {latestReport[c.id]
                ? `${latestReport[c.id]?.period_end} (${new Date(latestReport[c.id]!.created_at).toLocaleDateString()})`
                : 'none yet'}
            </Text>
            <Button
              variant="ghost"
              loading={sendingForClinic === c.id}
              onPress={() => {
                if (!user) return;
                void (async () => {
                  setSendingForClinic(c.id);
                  try {
                    const { error: sendErr } = await generateAndSendClinicRoiReport({
                      clinicId: c.id,
                      generatedByAuthUserId: user.id,
                    });
                    if (sendErr) {
                      Alert.alert('ROI Report', sendErr.message);
                      return;
                    }
                    Alert.alert('ROI Report', 'Report generated and sent to clinic owners.');
                    await load();
                  } finally {
                    setSendingForClinic(null);
                  }
                })();
              }}>
              Send ROI Report
            </Button>
          </View>
        ))}
      </AdminSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.dark },
  content: { paddingHorizontal: 20 },
  title: { ...typography.h1, color: colors.white, marginBottom: 8 },
  subtitle: { ...typography.body, color: colors.gray1, marginBottom: 14 },
  clinicCard: {
    backgroundColor: colors.darkCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: METRIC_CARD_BORDER,
    padding: 14,
    marginBottom: 10,
  },
  clinicName: { ...typography.body, color: colors.white, fontSize: 18, marginBottom: 10 },
  metricsRow: { flexDirection: 'row', gap: 10 },
  meta: { ...typography.body, color: colors.gray1, marginTop: 10, fontSize: 13 },
  error: { ...typography.body, color: colors.warning, marginBottom: 10 },
  empty: { ...typography.body, color: colors.gray2, marginBottom: 10 },
});
