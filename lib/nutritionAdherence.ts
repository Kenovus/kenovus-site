import { localDateKey } from '@/lib/patientSupplements';
import { supabase } from '@/lib/supabase';
import type { MacroGoalsNumbers } from '@/lib/patientNutritionTargets';

/** Fraction of last 7 local days where all logged macros are within `tolerance` of targets (default 10%). */
export async function computeSevenDayMacroAdherence(
  patientId: string,
  targets: MacroGoalsNumbers,
  tolerance = 0.1,
): Promise<{ score: number; daysWithLogs: number; daysHit: number }> {
  const end = new Date();
  const daysHitArr: boolean[] = [];
  let daysWithLogs = 0;

  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const dateKey = localDateKey(d);

    const { data, error } = await supabase
      .from('food_log_entries')
      .select('protein_g, carbs_g, fat_g, calories')
      .eq('patient_id', patientId)
      .eq('log_date', dateKey)
      .eq('entry_type', 'actual');

    if (error || !data?.length) {
      daysHitArr.push(false);
      continue;
    }
    daysWithLogs += 1;
    const sums = data.reduce(
      (acc, row) => ({
        p: acc.p + Number((row as { protein_g: number | null }).protein_g ?? 0),
        c: acc.c + Number((row as { carbs_g: number | null }).carbs_g ?? 0),
        f: acc.f + Number((row as { fat_g: number | null }).fat_g ?? 0),
        k: acc.k + Number((row as { calories: number | null }).calories ?? 0),
      }),
      { p: 0, c: 0, f: 0, k: 0 },
    );

    const hit =
      within(sums.p, targets.protein, tolerance) &&
      within(sums.c, targets.carbs, tolerance) &&
      within(sums.f, targets.fat, tolerance) &&
      within(sums.k, targets.calories, Math.max(tolerance, 0.12));
    daysHitArr.push(hit);
  }

  const daysHit = daysHitArr.filter(Boolean).length;
  const score = daysHit / 7;
  return { score, daysWithLogs, daysHit };
}

function within(actual: number, target: number, tol: number): boolean {
  if (target <= 0) return true;
  const lo = target * (1 - tol);
  const hi = target * (1 + tol);
  return actual >= lo && actual <= hi;
}

/** Mean kcal over last 7 local days (zeros for days without logs). */
export async function sevenDayAverageCalories(patientId: string): Promise<{ avg: number | null; daysWithLogs: number }> {
  const end = new Date();
  let sum = 0;
  let daysWithLogs = 0;
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const dateKey = localDateKey(d);
    const { data } = await supabase
      .from('food_log_entries')
      .select('calories')
      .eq('patient_id', patientId)
      .eq('log_date', dateKey)
      .eq('entry_type', 'actual');
    const dayTotal = (data ?? []).reduce((s, row) => s + Number((row as { calories: number | null }).calories ?? 0), 0);
    sum += dayTotal;
    if ((data ?? []).length) daysWithLogs += 1;
  }
  return { avg: sum / 7, daysWithLogs };
}
