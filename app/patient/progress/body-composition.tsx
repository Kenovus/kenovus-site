import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline, Rect } from 'react-native-svg';

import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/lib/theme/ThemeProvider';
import { toPounds } from '@/lib/weightLogs';

type Range = 7 | 30 | 180 | 365;

function seriesToPoints(values: number[], width = 320, height = 92): string {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.01, max - min);
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = ((max - v) / span) * height;
      return `${x},${y}`;
    })
    .join(' ');
}

export default function BodyCompositionCharts() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tokens } = useAppTheme();
  const styles = createStyles(tokens);
  const { user } = useAuth();
  const [range, setRange] = useState<Range>(30);
  const [weight, setWeight] = useState<number[]>([]);
  const [bodyFat, setBodyFat] = useState<number[]>([]);
  const [leanMass, setLeanMass] = useState<number[]>([]);
  const [proteinBars, setProteinBars] = useState<number[]>([]);
  const [workoutWeeks, setWorkoutWeeks] = useState<number[]>([]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const pid = await fetchPatientIdForAuthUser(user.id);
      if (!pid) return;
      const from = new Date();
      from.setDate(from.getDate() - range);
      const iso = from.toISOString().slice(0, 10);

      const [{ data: w }, { data: inb }, { data: food }, { data: goals }, { data: tr }] = await Promise.all([
        supabase
          .from('weight_logs')
          .select('weight_value, unit, log_date')
          .eq('patient_id', pid)
          .gte('log_date', iso)
          .order('log_date', { ascending: true }),
        supabase
          .from('inbody_scans')
          .select('body_fat_percent, skeletal_muscle_lbs, scan_date')
          .eq('patient_id', pid)
          .gte('scan_date', iso)
          .order('scan_date', { ascending: true }),
        supabase
          .from('food_log_entries')
          .select('log_date, protein_g')
          .eq('patient_id', pid)
          .eq('entry_type', 'actual')
          .gte('log_date', iso),
        supabase.from('patient_macro_goals').select('protein_goal_g').eq('patient_id', pid).maybeSingle(),
        supabase
          .from('training_logs')
          .select('workout_date')
          .eq('patient_id', pid)
          .gte('workout_date', new Date(Date.now() - 56 * 86400000).toISOString().slice(0, 10)),
      ]);

      setWeight((w ?? []).map((x) => toPounds(Number(x.weight_value ?? 0), x.unit === 'kg' ? 'kg' : 'lb')));
      const inbRows = inb ?? [];
      setBodyFat(inbRows.map((x) => Number(x.body_fat_percent ?? 0)).filter((x) => x > 0));
      setLeanMass(inbRows.map((x) => Number(x.skeletal_muscle_lbs ?? 0)).filter((x) => x > 0));

      const pTarget = Number(goals?.protein_goal_g ?? 1);
      const byDay = new Map<string, number>();
      for (const f of food ?? []) byDay.set(String(f.log_date), (byDay.get(String(f.log_date)) ?? 0) + Number(f.protein_g ?? 0));
      const bars = [...byDay.values()].slice(-Math.min(range, 30)).map((v) => Math.min(1.3, v / Math.max(1, pTarget)));
      setProteinBars(bars);

      const weekCounts = new Array(8).fill(0);
      for (const t of tr ?? []) {
        const d = new Date(String(t.workout_date));
        const idx = Math.min(7, Math.max(0, Math.floor((Date.now() - d.getTime()) / (7 * 86400000))));
        weekCounts[7 - idx] += 1;
      }
      setWorkoutWeeks(weekCounts);
    })();
  }, [user, range]);

  const wPts = useMemo(() => seriesToPoints(weight), [weight]);
  const bfPts = useMemo(() => seriesToPoints(bodyFat), [bodyFat]);
  const lmPts = useMemo(() => seriesToPoints(leanMass), [leanMass]);

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 24,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Body Composition Charts</Text>
      <View style={styles.toggleRow}>
        {([7, 30, 180, 365] as const).map((r) => (
          <Pressable key={r} onPress={() => setRange(r)} style={[styles.toggle, range === r && styles.toggleOn]}>
            <Text style={[styles.toggleTxt, range === r && styles.toggleTxtOn]}>{r === 180 ? '6m' : r === 365 ? '1y' : `${r}d`}</Text>
          </Pressable>
        ))}
      </View>

      <ChartCard title="Weight trend" points={wPts} />
      <ChartCard title="Body fat % trend" points={bfPts} />
      <ChartCard title="Lean mass trend" points={lmPts} />

      <View style={styles.card}>
        <Text style={styles.h}>Nutrition adherence (protein vs target)</Text>
        <Svg width={320} height={120}>
          {proteinBars.map((v, i) => (
            <Rect
              key={i}
              x={i * 10 + 2}
              y={120 - Math.min(110, v * 80)}
              width={8}
              height={Math.min(110, v * 80)}
              fill={v >= 1 ? tokens.colors.gold : tokens.colors.coral}
            />
          ))}
        </Svg>
      </View>

      <View style={styles.card}>
        <Text style={styles.h}>Workout frequency (last 8 weeks)</Text>
        <Svg width={320} height={120}>
          {workoutWeeks.map((v, i) => (
            <Rect key={i} x={i * 36 + 6} y={120 - v * 16} width={24} height={v * 16} fill={tokens.colors.navy} />
          ))}
        </Svg>
      </View>
    </ScrollView>
  );
}

function ChartCard({ title, points }: { title: string; points: string }) {
  const { tokens } = useAppTheme();
  const styles = createStyles(tokens);
  return (
    <View style={styles.card}>
      <Text style={styles.h}>{title}</Text>
      {points ? (
        <Svg width={320} height={92}>
          <Polyline points={points} fill="none" stroke={tokens.colors.gold} strokeWidth={2} />
        </Svg>
      ) : (
        <Text style={styles.meta}>Not enough data.</Text>
      )}
    </View>
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
  };
  const typography = {
    h2: tokens.typography.h2,
    body: tokens.typography.body,
  };
  return StyleSheet.create({
  backBtn: { alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 6 },
  backText: { ...typography.body, color: colors.gold, fontSize: 16 },
  wrap: { flex: 1, backgroundColor: colors.dark },
  title: { ...tokens.typography.section, color: colors.white, marginBottom: 8 },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  toggle: { borderWidth: 1, borderColor: colors.goldDim, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  toggleOn: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.2)' },
  toggleTxt: { color: colors.gray1, fontSize: 15 },
  toggleTxtOn: { color: colors.white, fontWeight: '700' },
  card: { borderWidth: 1, borderColor: colors.goldDim, borderRadius: 12, backgroundColor: colors.darkCard, padding: 12, marginBottom: 12 },
  h: { ...tokens.typography.section, color: colors.white, marginBottom: 8, fontSize: 24 },
  meta: { ...typography.body, color: colors.gray2, fontSize: 15 },
});
};
