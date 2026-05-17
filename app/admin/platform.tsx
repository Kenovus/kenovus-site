import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdminMetricGrid } from '@/components/admin/AdminMetricGrid';
import { AdminSection } from '@/components/admin/AdminSection';
import { METRIC_CARD_BORDER, MetricCard } from '@/components/admin/MetricCard';
import { colors, typography } from '@/constants/designSystem';
import { fetchSuperAdminOverview } from '@/lib/adminMetrics';

export default function AdminPlatformScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    liveSessions: 0,
    apiCallsToday: 0,
    storageUsedLabel: '—',
    errorRate: 0,
    alerts: ['Loading...'],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await fetchSuperAdminOverview();
      if (!data || error) {
        setStats((s) => ({ ...s, alerts: [error?.message ?? 'Could not load platform health'] }));
        return;
      }
      setStats({
        liveSessions: data.liveSessions,
        apiCallsToday: data.apiCallsToday,
        storageUsedLabel: data.storageUsedLabel,
        errorRate: data.errorRate,
        alerts: data.alerts,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: 30 }]}>
      <Text style={styles.title}>Platform Health</Text>
      <Text style={styles.subtitle}>Sessions, API usage, storage, error rate, active alerts.</Text>

      <AdminSection title="Live Status">
        <AdminMetricGrid>
          <MetricCard label="Live Sessions" value={String(stats.liveSessions)} confidence="real" />
          <MetricCard label="API Calls Today" value={stats.apiCallsToday.toLocaleString()} confidence="real" />
          <MetricCard label="Storage Used" value={stats.storageUsedLabel} confidence="proxy" />
          <MetricCard label="Error Rate" value={`${(stats.errorRate * 100).toFixed(1)}%`} confidence="proxy" />
        </AdminMetricGrid>
      </AdminSection>

      <AdminSection title="Active Alerts">
        <View style={styles.alertCard}>
          {stats.alerts.map((a) => (
            <Text key={a} style={styles.alert}>
              {a}
            </Text>
          ))}
        </View>
      </AdminSection>
      <Text style={styles.meta}>{loading ? 'Refreshing...' : 'Live data loaded from Supabase.'}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.dark },
  content: { paddingHorizontal: 20 },
  title: { ...typography.h1, color: colors.white, marginBottom: 8 },
  subtitle: { ...typography.body, color: colors.gray1, marginBottom: 14 },
  alertCard: {
    backgroundColor: colors.darkCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: METRIC_CARD_BORDER,
    padding: 14,
    gap: 8,
  },
  alert: { ...typography.body, color: colors.white, fontSize: 14 },
  meta: { ...typography.body, color: colors.gray2, marginTop: 8, fontSize: 12 },
});
