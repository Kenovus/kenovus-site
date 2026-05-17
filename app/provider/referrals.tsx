import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { getProviderClinicReferralSummary } from '@/lib/referrals';

export default function ProviderReferrals() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{
    clinicName: string | null;
    total: number;
    booked: number;
    completed: number;
    pendingPerks: number;
    topCodes: Array<{ code: string; count: number }>;
  }>({
    clinicName: null,
    total: 0,
    booked: 0,
    completed: 0,
    pendingPerks: 0,
    topCodes: [],
  });

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { clinicName, total, booked, completed, pendingPerks, topCodes, error } =
        await getProviderClinicReferralSummary(user.id);
      if (error) {
        Alert.alert('Referral tracking', error.message);
        return;
      }
      setSummary({ clinicName, total, booked, completed, pendingPerks, topCodes });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 28, paddingHorizontal: 20 }}>
      <Text style={styles.title}>Referral tracking</Text>
      <Text style={styles.subtitle}>{summary.clinicName ?? 'Clinic'} referral funnel and top codes.</Text>

      <View style={styles.grid}>
        <Metric label="Total" value={summary.total} />
        <Metric label="Booked" value={summary.booked} />
        <Metric label="Completed" value={summary.completed} />
        <Metric label="Pending perks" value={summary.pendingPerks} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Top codes</Text>
        {summary.topCodes.length === 0 ? (
          <Text style={styles.rowText}>No referral activity yet.</Text>
        ) : (
          summary.topCodes.map((row) => (
            <View key={row.code} style={styles.row}>
              <Text style={styles.rowText}>{row.code}</Text>
              <Text style={styles.rowText}>{row.count}</Text>
            </View>
          ))
        )}
      </View>

      <Button variant="ghost" onPress={() => void load()} loading={loading}>
        Refresh
      </Button>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.dark },
  title: { ...typography.h2, color: colors.white, marginBottom: 6 },
  subtitle: { ...typography.body, color: colors.gray1, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  metric: {
    width: '48%',
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.darkCard,
  },
  metricValue: { ...typography.h2, color: colors.white, fontSize: 28 },
  metricLabel: { ...typography.body, color: colors.gray1, fontSize: 13 },
  card: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.darkCard,
    marginBottom: 12,
  },
  label: { ...typography.label, color: colors.gold, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rowText: { ...typography.body, color: colors.white },
});
