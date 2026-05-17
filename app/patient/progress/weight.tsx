import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { mergeServerUserProfileRow } from '@/lib/authProfileMerge';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { localDateKey } from '@/lib/patientSupplements';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/lib/theme/ThemeProvider';
import {
  fetchWeightLogsForPatient,
  fromPounds,
  insertWeightLog,
  toPounds,
  type WeightLogRow,
  type WeightUnit,
} from '@/lib/weightLogs';
import { latestWeightLbsByDate, rollingMeanWeightLbs } from '@/lib/weightRollingAverage';

const SPARK_W = 320;
const SPARK_H = 72;
const MILESTONE_STORAGE_PREFIX = 'sonalife_weight_milestone_5lb_';

type RangeKey = 7 | 30 | 90;

function parseNumpadInput(raw: string, allowDecimal: boolean): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = allowDecimal ? Number(t) : Number.parseInt(t, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function sparkPoints(rowsChrono: WeightLogRow[], displayUnit: WeightUnit): { x: number; y: number }[] {
  if (rowsChrono.length < 2) return [];
  const lbsSeries = rowsChrono.map((r) => toPounds(r.weight_value, r.unit));
  const vals = lbsSeries.map((lb) => fromPounds(lb, displayUnit));
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pad = 6;
  const span = Math.max(max - min, 0.01);
  return vals.map((v, i) => ({
    x: pad + (i / (vals.length - 1)) * (SPARK_W - pad * 2),
    y: pad + ((max - v) / span) * (SPARK_H - pad * 2),
  }));
}

export default function ProgressWeight() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tokens } = useAppTheme();
  const styles = createStyles(tokens);
  const { user, profile, refreshProfile } = useAuth();
  const [rows, setRows] = useState<WeightLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [displayUnit, setDisplayUnit] = useState<WeightUnit>('lb');
  const [weightInput, setWeightInput] = useState('');
  const [range, setRange] = useState<RangeKey>(30);
  const [celebrate, setCelebrate] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const u = profile?.weight_unit_preference;
    setDisplayUnit(u === 'kg' ? 'kg' : 'lb');
  }, [profile?.weight_unit_preference]);

  const load = useCallback(async () => {
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const pid = await fetchPatientIdForAuthUser(user.id);
      setPatientId(pid);
      if (!pid) return;
      const { rows: all } = await fetchWeightLogsForPatient(pid, 200);
      setRows(all);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredChrono = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range);
    const ms = cutoff.getTime();
    const slice = rows.filter((r) => new Date(r.logged_at).getTime() >= ms);
    return [...slice].sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());
  }, [rows, range]);

  const stats = useMemo(() => {
    if (rows.length === 0) {
      return {
        current: null as number | null,
        start: null as number | null,
        deltaLb: null as number | null,
        trend: '—' as string,
        todayLb: null as number | null,
        avg7Lb: null as number | null,
      };
    }
    const chronoAll = [...rows].sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());
    const latest = chronoAll[chronoAll.length - 1]!;
    const first = chronoAll[0]!;
    const curLb = toPounds(latest.weight_value, latest.unit);
    const startLb = toPounds(first.weight_value, first.unit);
    const delta = curLb - startLb;
    let trend = 'Stable';
    if (delta < -0.5) trend = 'Trending down';
    if (delta > 0.5) trend = 'Trending up';
    const byDay = latestWeightLbsByDate(rows);
    const todayLb = byDay.get(localDateKey(new Date())) ?? null;
    const avg7Lb = rollingMeanWeightLbs(rows, 7);
    return { current: curLb, start: startLb, deltaLb: delta, trend, todayLb, avg7Lb };
  }, [rows]);

  const points = useMemo(() => sparkPoints(filteredChrono, displayUnit), [filteredChrono, displayUnit]);
  const pointsStr = points.map((p) => `${p.x},${p.y}`).join(' ');

  const persistUnit = async (u: WeightUnit) => {
    if (!user) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({ weight_unit_preference: u })
        .eq('auth_user_id', user.id)
        .select('*')
        .maybeSingle();
      if (error) {
        Alert.alert('Could not save preference', error.message);
        return;
      }
      if (data) mergeServerUserProfileRow(data as Record<string, unknown>);
      await refreshProfile();
      setDisplayUnit(u);
    } finally {
      setBusy(false);
    }
  };

  const celebrateIfNeeded = async (pid: string, list: WeightLogRow[]) => {
    if (list.length < 2) return;
    const chrono = [...list].sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());
    const first = chrono[0]!;
    const last = chrono[chrono.length - 1]!;
    const startLb = toPounds(first.weight_value, first.unit);
    const curLb = toPounds(last.weight_value, last.unit);
    const lost = startLb - curLb;
    if (lost < 5) return;
    const bucket = Math.floor(lost / 5);
    const key = `${MILESTONE_STORAGE_PREFIX}${pid}`;
    const prev = Number((await AsyncStorage.getItem(key)) ?? '0');
    if (bucket > prev) {
      await AsyncStorage.setItem(key, String(bucket));
      setCelebrate(true);
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.12, duration: 220, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start(() => {
        setTimeout(() => setCelebrate(false), 1800);
      });
    }
  };

  const saveWeight = async () => {
    const allowDecimal = displayUnit === 'kg' || weightInput.includes('.');
    const val = parseNumpadInput(weightInput, allowDecimal);
    if (!val || !user || !patientId) {
      Alert.alert('Enter weight', `Use the pad to enter your weight in ${displayUnit === 'kg' ? 'kg' : 'lbs'}.`);
      return;
    }
    if (displayUnit === 'lb' && (val < 60 || val > 500)) {
      Alert.alert('Check value', 'Enter a realistic weight in pounds.');
      return;
    }
    if (displayUnit === 'kg' && (val < 30 || val > 250)) {
      Alert.alert('Check value', 'Enter a realistic weight in kilograms.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await insertWeightLog({
        patientId: patientId,
        weightValue: val,
        unit: displayUnit,
      });
      if (error) {
        Alert.alert('Save failed', error);
        return;
      }
      setWeightInput('');
      const { rows: fresh } = await fetchWeightLogsForPatient(patientId, 200);
      setRows(fresh);
      await celebrateIfNeeded(patientId, fresh);
      Alert.alert('Saved', 'Your weight was logged.');
    } finally {
      setBusy(false);
    }
  };

  const fmt = (lb: number | null) => {
    if (lb == null) return '—';
    const v = fromPounds(lb, displayUnit);
    return `${v.toFixed(displayUnit === 'kg' ? 1 : 1)} ${displayUnit === 'kg' ? 'kg' : 'lb'}`;
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={88}>
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32, paddingHorizontal: 24 }}>
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Weight</Text>
      <Text style={styles.sub}>Log weight is saved to your history and today&apos;s vitality row.</Text>

      <View style={styles.unitRow}>
        <Text style={styles.label}>Unit</Text>
        <View style={styles.unitToggle}>
          <Pressable
            onPress={() => void persistUnit('lb')}
            style={[styles.unitChip, displayUnit === 'lb' && styles.unitChipOn]}>
            <Text style={[styles.unitChipText, displayUnit === 'lb' && styles.unitChipTextOn]}>lb</Text>
          </Pressable>
          <Pressable
            onPress={() => void persistUnit('kg')}
            style={[styles.unitChip, displayUnit === 'kg' && styles.unitChipOn]}>
            <Text style={[styles.unitChipText, displayUnit === 'kg' && styles.unitChipTextOn]}>kg</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Overview</Text>
        <Text style={styles.statsLine}>
          Today: {fmt(stats.todayLb)} | 7-day avg: {fmt(stats.avg7Lb)}
        </Text>
        <Text style={styles.statsLine}>Latest log: {fmt(stats.current)}</Text>
        <Text style={styles.statsLine}>Starting (first log): {fmt(stats.start)}</Text>
        <Text style={styles.statsLine}>
          Change:{' '}
          {stats.deltaLb == null
            ? '—'
            : `${stats.deltaLb > 0 ? '+' : ''}${fromPounds(Math.abs(stats.deltaLb), displayUnit).toFixed(1)} ${displayUnit === 'kg' ? 'kg' : 'lb'}`}
        </Text>
        <Text style={styles.statsLine}>Trend: {stats.trend}</Text>
      </View>

      <Text style={styles.label}>Chart range</Text>
      <View style={styles.rangeRow}>
        {([7, 30, 90] as const).map((d) => (
          <Pressable key={d} onPress={() => setRange(d)} style={[styles.rangeChip, range === d && styles.rangeChipOn]}>
            <Text style={[styles.rangeChipText, range === d && styles.rangeChipTextOn]}>{d}d</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.sparkBox}>
        {points.length > 1 ? (
          <Svg width={SPARK_W} height={SPARK_H}>
            <Polyline points={pointsStr} fill="none" stroke={colors.gold} strokeWidth={2} />
          </Svg>
        ) : (
          <Text style={styles.meta}>Log at least two weights in this range to see a trend.</Text>
        )}
      </View>

      {celebrate ? (
        <Animated.View style={[styles.celebrate, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.celebrateText}>Nice work — another 5 lb milestone.</Text>
        </Animated.View>
      ) : null}

      <Text style={[styles.label, { marginTop: 24 }]}>Log weight</Text>
      <TextInput
        value={weightInput}
        onChangeText={setWeightInput}
        placeholder={displayUnit === 'kg' ? 'e.g. 78.2' : 'e.g. 185'}
        placeholderTextColor={tokens.colors.textCaption}
        keyboardType="decimal-pad"
        style={styles.bigInput}
        maxLength={8}
        selectTextOnFocus
      />
      <Button loading={busy} onPress={() => void saveWeight()} variant="primary">
        Save
      </Button>

      <Text style={[styles.label, { marginTop: 24 }]}>Recent logs</Text>
      {loading ? <Text style={styles.meta}>Loading…</Text> : null}
      {rows.slice(0, 25).map((r) => (
        <View key={r.id} style={styles.row}>
          <Text style={styles.date}>{r.log_date}</Text>
          <Text style={styles.val}>
            {r.weight_value} {r.unit}
          </Text>
        </View>
      ))}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (tokens: ReturnType<typeof useAppTheme>['tokens']) => {
  const colors = {
    dark: tokens.colors.background,
    darkCard: tokens.colors.surface,
    gold: tokens.colors.accent,
    goldDim: tokens.colors.border,
    white: tokens.colors.text,
    gray1: tokens.colors.textMuted,
    gray2: tokens.colors.textCaption,
    warning: tokens.colors.warning,
  };
  const typography = {
    h1: tokens.typography.h1,
    body: tokens.typography.body,
    label: tokens.typography.label,
  };
  return StyleSheet.create({
  backBtn: { alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 6 },
  backText: { ...typography.body, color: colors.gold, fontSize: 16 },
  wrap: { flex: 1, backgroundColor: colors.dark },
  title: { ...tokens.typography.section, color: colors.white, marginBottom: 8 },
  sub: { ...typography.body, color: colors.gray1, marginBottom: 16 },
  label: { ...typography.label, color: colors.gold, marginBottom: 8 },
  unitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  unitToggle: { flexDirection: 'row', gap: 8 },
  unitChip: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  unitChipOn: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.2)' },
  unitChipText: { ...typography.body, color: colors.gray1 },
  unitChipTextOn: { color: colors.white, fontWeight: '600' },
  statsCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.goldDim,
    padding: 16,
    marginBottom: 16,
    backgroundColor: colors.darkCard,
  },
  statsTitle: { ...typography.body, color: colors.white, fontWeight: '600', marginBottom: 8 },
  statsLine: { ...typography.body, color: colors.gray1, marginBottom: 8 },
  rangeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  rangeChip: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  rangeChipOn: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.15)' },
  rangeChipText: { color: colors.gray1 },
  rangeChipTextOn: { color: colors.white, fontWeight: '600' },
  sparkBox: {
    alignItems: 'center',
    marginBottom: 8,
    minHeight: SPARK_H,
    justifyContent: 'center',
  },
  celebrate: {
    backgroundColor: 'rgba(201,168,76,0.2)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  celebrateText: { ...typography.body, color: colors.white, textAlign: 'center', fontWeight: '600' },
  bigInput: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 44,
    color: colors.white,
    textAlign: 'center',
    backgroundColor: colors.darkCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.goldDim,
    paddingVertical: 24,
    marginBottom: 16,
  },
  meta: { ...typography.body, color: colors.gray2 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.goldDim,
  },
  date: { ...typography.body, color: colors.gray1 },
  val: { ...typography.body, color: colors.white },
});
};
