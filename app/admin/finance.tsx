import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdminMetricGrid } from '@/components/admin/AdminMetricGrid';
import { AdminSection } from '@/components/admin/AdminSection';
import { METRIC_CARD_BORDER, MetricCard } from '@/components/admin/MetricCard';
import { colors, typography } from '@/constants/designSystem';
import { fetchSuperAdminOverview } from '@/lib/adminMetrics';
import { supabase } from '@/lib/supabase';

export default function AdminFinanceScreen() {
  const insets = useSafeAreaInsets();
  const [metrics, setMetrics] = useState({
    mrr: 0,
    arr: 0,
    pending: 0,
    net: 0,
    aiCost: 0,
    infraCost: 0,
    toolsCost: 0,
  });

  const load = useCallback(async () => {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
    const [overviewRes, { data: rows }] = await Promise.all([
      fetchSuperAdminOverview(),
      supabase.from('financial_transactions').select('amount, is_refund').gte('transaction_date', monthStart),
    ]);
    const mrr = overviewRes.data?.totalMrr ?? 0;
    const arr = mrr * 12;
    const gross = (rows ?? []).reduce((acc, r) => {
      const amount = Number(r.amount ?? 0);
      return acc + (r.is_refund === true ? -Math.abs(amount) : amount);
    }, 0);
    const aiCost = Math.round((overviewRes.data?.apiCallsToday ?? 0) * 0.025);
    const infraCost = Math.round(gross * 0.03);
    const toolsCost = Math.round(gross * 0.02);
    const net = gross - aiCost - infraCost - toolsCost;
    setMetrics({
      mrr,
      arr,
      pending: Math.max(0, Math.round(gross * 0.18)),
      net,
      aiCost,
      infraCost,
      toolsCost,
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: 30 }]}>
      <Text style={styles.title}>Financial Intelligence</Text>
      <Text style={styles.subtitle}>MRR, ARR, Stripe payouts, API cost, and net profit.</Text>

      <AdminSection title="Financial Snapshot">
        <AdminMetricGrid>
          <MetricCard label="MRR" value={`$${Math.round(metrics.mrr).toLocaleString()}`} confidence="real" />
          <MetricCard label="ARR" value={`$${Math.round(metrics.arr).toLocaleString()}`} confidence="proxy" />
          <MetricCard label="Stripe Pending" value={`$${Math.round(metrics.pending).toLocaleString()}`} confidence="proxy" />
          <MetricCard label="Net Profit" value={`$${Math.round(metrics.net).toLocaleString()}`} confidence="proxy" />
        </AdminMetricGrid>
      </AdminSection>

      <AdminSection title="Cost Breakdown">
        <View style={styles.costCard}>
          <Text style={styles.costLine}>AI Cost Proxy (MTD): ${Math.round(metrics.aiCost).toLocaleString()}</Text>
          <Text style={styles.costLine}>Infra Proxy (MTD): ${Math.round(metrics.infraCost).toLocaleString()}</Text>
          <Text style={styles.costLine}>Subscriptions/tools Proxy (MTD): ${Math.round(metrics.toolsCost).toLocaleString()}</Text>
        </View>
      </AdminSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.dark },
  content: { paddingHorizontal: 20 },
  title: { ...typography.h1, color: colors.white, marginBottom: 8 },
  subtitle: { ...typography.body, color: colors.gray1, marginBottom: 14 },
  costCard: {
    backgroundColor: colors.darkCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: METRIC_CARD_BORDER,
    padding: 14,
    gap: 8,
  },
  costLine: { ...typography.body, color: colors.white },
});
