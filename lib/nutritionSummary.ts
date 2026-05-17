import { localDateKey } from '@/lib/patientSupplements';
import { supabase } from '@/lib/supabase';

export type DayMacro = { date: string; protein: number; calories: number };

/** Last 7 local days including today; sums protein and calories from food_log_entries (actual). */
export async function fetchLast7DayMacros(patientId: string): Promise<DayMacro[]> {
  const end = new Date();
  const days: DayMacro[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    days.push({ date: localDateKey(d), protein: 0, calories: 0 });
  }
  const from = days[0]?.date;
  const to = days[days.length - 1]?.date;
  if (!from || !to) return days;

  const { data, error } = await supabase
    .from('food_log_entries')
    .select('log_date, protein_g, calories')
    .eq('patient_id', patientId)
    .eq('entry_type', 'actual')
    .gte('log_date', from)
    .lte('log_date', to);

  if (error || !data) return days;

  const byDate = new Map<string, { protein: number; calories: number }>();
  for (const row of data as { log_date: string; protein_g: number | null; calories: number | null }[]) {
    const k = String(row.log_date);
    const cur = byDate.get(k) ?? { protein: 0, calories: 0 };
    cur.protein += Number(row.protein_g ?? 0);
    cur.calories += Number(row.calories ?? 0);
    byDate.set(k, cur);
  }

  return days.map((d) => {
    const v = byDate.get(d.date);
    return { date: d.date, protein: v?.protein ?? 0, calories: v?.calories ?? 0 };
  });
}

export type WeeklyNutritionSummary = {
  bestDay: string | null;
  worstDay: string | null;
  avgProtein: number;
  avgProteinVsTargetPct: number | null;
};

export function buildWeeklyNutritionSummary(
  days: DayMacro[],
  proteinTarget: number,
): WeeklyNutritionSummary {
  const withAny = days.filter((d) => d.calories > 0 || d.protein > 0);
  if (withAny.length === 0) {
    return { bestDay: null, worstDay: null, avgProtein: 0, avgProteinVsTargetPct: null };
  }
  const tgt = Math.max(1, proteinTarget);
  let best = withAny[0]!;
  let worst = withAny[0]!;
  for (const d of withAny) {
    if (d.protein > best.protein) best = d;
    if (d.protein < worst.protein) worst = d;
  }
  const avgProtein = withAny.reduce((s, d) => s + d.protein, 0) / withAny.length;
  const avgPct = (avgProtein / tgt) * 100;
  return {
    bestDay: best.date,
    worstDay: worst.date,
    avgProtein,
    avgProteinVsTargetPct: avgPct,
  };
}
