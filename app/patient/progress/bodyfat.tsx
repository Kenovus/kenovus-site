import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { listInBodyScansForAuthUser } from '@/lib/inbody';
import {
  BodyFatVisualizer2DFallback,
  hasBodyFat3D,
  SafeBodyFatVisualizer3D,
} from '@/lib/safeBodyFatVisualizer';

function fmt(v: number | null): string {
  return typeof v === 'number' && Number.isFinite(v) ? `${v.toFixed(1)}%` : '--';
}

export default function ProgressBodyfat() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [bodyFatHistory, setBodyFatHistory] = useState<number[]>([]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user?.id) {
        setBodyFatHistory([]);
        setErr('Sign in required.');
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const { rows, error } = await listInBodyScansForAuthUser(user.id);
      if (error) {
        setErr(error.message || 'Unable to load body fat data.');
      } else {
        setErr(null);
        setBodyFatHistory(rows.map((r) => r.body_fat_percent).filter((v): v is number => typeof v === 'number'));
      }

      setLoading(false);
      setRefreshing(false);
    },
    [user?.id],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  const latest = bodyFatHistory.length ? bodyFatHistory[0] : null;
  const prior = bodyFatHistory.length > 1 ? bodyFatHistory[1] : null;
  const delta = useMemo(() => {
    if (typeof latest !== 'number' || typeof prior !== 'number') return null;
    return latest - prior;
  }, [latest, prior]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.white} />}
    >
      <Text style={styles.title}>Body fat · 3D</Text>
      <Text style={styles.subtitle}>
        A visual proxy from your InBody trends. Lower percentages tighten torso/hips profile over time.
      </Text>

      <View style={styles.card}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.gold} />
          </View>
        ) : latest == null ? (
          <View style={styles.loadingWrap}>
            <Text style={styles.emptyText}>No InBody body fat data yet. Add a scan to render your model.</Text>
          </View>
        ) : !hasBodyFat3D || !SafeBodyFatVisualizer3D ? (
          <View style={styles.canvasWrap}>
            <BodyFatVisualizer2DFallback latest={latest} prior={prior} delta={delta} />
          </View>
        ) : (
          <View style={styles.canvasWrap}>
            <SafeBodyFatVisualizer3D bodyFatPercent={latest} />
          </View>
        )}
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Latest</Text>
          <Text style={styles.metricValue}>{fmt(latest)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Prior</Text>
          <Text style={styles.metricValue}>{fmt(prior)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Delta</Text>
          <Text style={styles.metricValue}>
            {delta == null ? '--' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`}
          </Text>
        </View>
      </View>

      {!!err && <Text style={styles.errorText}>{err}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  content: { paddingHorizontal: 22 },
  title: { ...typography.h2, color: colors.white, marginBottom: 6 },
  subtitle: { ...typography.body, color: colors.gray1, marginBottom: 16 },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: '#0f1117',
    overflow: 'hidden',
    marginBottom: 12,
    minHeight: 340,
  },
  canvasWrap: { height: 340 },
  loadingWrap: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  emptyText: { ...typography.body, color: colors.gray1, textAlign: 'center' },
  metricsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: '#11141c',
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  metricLabel: { ...typography.label, color: colors.gray1, marginBottom: 6, letterSpacing: 1.2 },
  metricValue: { ...typography.h2, color: colors.white, fontSize: 20 },
  errorText: { ...typography.body, color: colors.danger, marginTop: 10 },
});
