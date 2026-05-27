/**
 * Data plumbing for the Physique Forecast screen.
 *
 * Pulls the goal, macro targets, recent weights, recent food protein,
 * recent training, and recent daily_wins in parallel. Maps everything
 * into the shape the projection engine wants.
 */
import { supabase } from '@/lib/supabase';
import { fetchPatientGoals, daysUntilTargetDate } from '@/lib/patientGoals';
import { toPounds } from '@/lib/weightLogs';
import type { ActualDataPoint, PhysiqueGoal } from '@/lib/physiqueProjection';

export interface ForecastBundle {
  hasGoal: boolean;
  goal: PhysiqueGoal | null;
  actuals: ActualDataPoint[];
  /** Days from today to goal date (>= 0). null if no goal date. */
  daysRemaining: number | null;
  /** Friendly plan name. */
  planName: string;
  /** Latest known body fat % (from inbody_results if any). */
  currentBodyFat: number | null;
  /** Latest known weight (lbs). */
  currentWeight: number | null;
  /** Daily protein target (g). */
  proteinTarget: number;
  /** Daily calorie target (kcal). */
  calorieTarget: number;
}

const DEFAULT_BODY_FAT_START = 22;
const DEFAULT_BODY_FAT_GOAL = 15;
const HORIZON_DAYS = 365; // pull actuals over the last year

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function planNameFor(primaryGoal: string | null | undefined): string {
  switch (primaryGoal) {
    case 'lose_body_fat': return 'Cut Plan';
    case 'build_muscle_recomp': return 'Recomp Plan';
    case 'stage_ready': return 'Stage Prep Plan';
    case 'health_longevity': return 'Longevity Plan';
    case 'glp1_journey': return 'GLP-1 Plan';
    default: return 'Physique Plan';
  }
}

async function withTimeout<T>(p: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function fetchForecastBundle(patientId: string): Promise<ForecastBundle> {
  const since = new Date();
  since.setDate(since.getDate() - HORIZON_DAYS);
  const sinceIso = isoDate(since);

  // postgrest builders are PromiseLike; withTimeout returns the eventual response.
  // Use `any` fallbacks because postgrest response generics are noisy here.
  const empty = { data: null, error: null } as never;
  const emptyArr = { data: [] as never[], error: null } as never;
  const [goalRow, macroRow, weightRowsRes, foodRowsRes, trainingRowsRes, winRowsRes, inbodyRes, startWeightRes] = await Promise.all([
    withTimeout(fetchPatientGoals(patientId), 5_000, null),
    withTimeout<{ data: { calories: number | null; protein_g: number | null } | null }>(
      supabase.from('patient_macro_goals').select('calories, protein_g').eq('patient_id', patientId).maybeSingle(),
      5_000,
      empty,
    ),
    withTimeout<{ data: Array<Record<string, unknown>> | null }>(
      supabase
        .from('weight_logs')
        .select('log_date, weight_value, unit')
        .eq('patient_id', patientId)
        .gte('log_date', sinceIso)
        .order('log_date', { ascending: true }) as unknown as PromiseLike<{ data: Array<Record<string, unknown>> | null }>,
      5_000,
      emptyArr,
    ),
    withTimeout<{ data: Array<Record<string, unknown>> | null }>(
      supabase
        .from('food_log_entries')
        .select('log_date, protein_g')
        .eq('patient_id', patientId)
        .gte('log_date', sinceIso) as unknown as PromiseLike<{ data: Array<Record<string, unknown>> | null }>,
      5_000,
      emptyArr,
    ),
    withTimeout<{ data: Array<Record<string, unknown>> | null }>(
      supabase
        .from('training_logs')
        .select('workout_date')
        .eq('patient_id', patientId)
        .gte('workout_date', sinceIso) as unknown as PromiseLike<{ data: Array<Record<string, unknown>> | null }>,
      5_000,
      emptyArr,
    ),
    withTimeout<{ data: Array<Record<string, unknown>> | null }>(
      supabase
        .from('daily_wins')
        .select('win_date, protein_hit, training_done, steps_hit, all_three')
        .eq('patient_id', patientId)
        .gte('win_date', sinceIso) as unknown as PromiseLike<{ data: Array<Record<string, unknown>> | null }>,
      5_000,
      emptyArr,
    ),
    withTimeout<{ data: { test_date: string; body_fat_pct: number | null; weight_lbs: number | null } | null }>(
      supabase
        .from('inbody_results')
        .select('test_date, body_fat_pct, weight_lbs')
        .eq('patient_id', patientId)
        .order('test_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      5_000,
      empty,
    ),
    withTimeout<{ data: { start_weight_lbs: number | null; created_at: string | null } | null }>(
      supabase
        .from('patients')
        .select('start_weight_lbs, created_at')
        .eq('id', patientId)
        .maybeSingle(),
      5_000,
      empty,
    ),
  ]);

  const targetWeight = goalRow?.target_weight ?? null;
  const targetBodyFat = goalRow?.target_body_fat_pct ?? null;
  const targetDate = goalRow?.target_date ?? null;

  const hasGoal = Boolean(goalRow && (targetWeight != null || targetDate));

  // Derive start weight: explicit `patients.start_weight_lbs` > earliest weight_log > current weight
  const weightRows = (weightRowsRes.data ?? []).map((r) => ({
    date: String((r as { log_date: unknown }).log_date),
    lbs: toPounds(
      Number((r as { weight_value: unknown }).weight_value),
      (r as { unit: unknown }).unit === 'kg' ? 'kg' : 'lb',
    ),
  }));
  const latestWeight = weightRows.length ? weightRows[weightRows.length - 1].lbs : null;
  const earliestWeight = weightRows.length ? weightRows[0].lbs : null;
  const startWeight =
    startWeightRes.data?.start_weight_lbs ??
    earliestWeight ??
    latestWeight ??
    targetWeight ??
    180;

  // Start body fat: latest inbody result if present; else default
  const startBodyFat = inbodyRes.data?.body_fat_pct ?? DEFAULT_BODY_FAT_START;
  const goalBodyFat = targetBodyFat ?? DEFAULT_BODY_FAT_GOAL;

  // Start date: patient_goals.created_at (date portion) if available; else earliest weight log; else today
  let startDateIso: string;
  if (goalRow?.created_at) startDateIso = String(goalRow.created_at).slice(0, 10);
  else if (weightRows.length) startDateIso = weightRows[0].date;
  else if (startWeightRes.data?.created_at) startDateIso = String(startWeightRes.data.created_at).slice(0, 10);
  else startDateIso = isoDate(new Date());

  // Goal date: default to 12 weeks out if missing.
  const goalDateIso =
    targetDate ||
    isoDate(new Date(Date.now() + 84 * 86_400_000));

  const calorieTarget = macroRow.data?.calories ?? 2400;
  const proteinTarget = macroRow.data?.protein_g ?? 180;

  const goal: PhysiqueGoal | null = hasGoal
    ? {
        startDate: startDateIso,
        goalDate: goalDateIso,
        startWeight,
        goalWeight: targetWeight ?? startWeight,
        startBodyFat,
        goalBodyFat,
        dailyCalories: calorieTarget,
        dailyProtein: proteinTarget,
      }
    : null;

  // Build actuals map by date
  const byDate = new Map<string, ActualDataPoint>();

  for (const r of weightRows) {
    const e = byDate.get(r.date) ?? { date: r.date };
    e.weight = r.lbs;
    e.hasAnyLog = true;
    byDate.set(r.date, e);
  }
  // protein per day from food_log_entries
  const proteinByDate = new Map<string, number>();
  for (const r of foodRowsRes.data ?? []) {
    const row = r as { log_date: unknown; protein_g: unknown };
    const d = String(row.log_date);
    proteinByDate.set(d, (proteinByDate.get(d) ?? 0) + Number(row.protein_g ?? 0));
  }
  for (const [d, total] of proteinByDate.entries()) {
    const e = byDate.get(d) ?? { date: d };
    e.proteinHit = total >= proteinTarget * 0.9;
    e.hasAnyLog = true;
    byDate.set(d, e);
  }
  const trainingDays = new Set(
    (trainingRowsRes.data ?? []).map((r) => String((r as { workout_date: unknown }).workout_date)),
  );
  for (const d of trainingDays) {
    const e = byDate.get(d) ?? { date: d };
    e.trainingDone = true;
    e.hasAnyLog = true;
    byDate.set(d, e);
  }
  for (const r of winRowsRes.data ?? []) {
    const row = r as { win_date: unknown; protein_hit: unknown; training_done: unknown; steps_hit: unknown };
    const d = String(row.win_date);
    const e = byDate.get(d) ?? { date: d };
    e.proteinHit = e.proteinHit || Boolean(row.protein_hit);
    e.trainingDone = e.trainingDone || Boolean(row.training_done);
    e.stepsHit = Boolean(row.steps_hit);
    e.hasAnyLog = true;
    byDate.set(d, e);
  }

  const actuals = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    hasGoal,
    goal,
    actuals,
    daysRemaining: daysUntilTargetDate(targetDate),
    planName: planNameFor(goalRow?.primary_goal),
    currentBodyFat: inbodyRes.data?.body_fat_pct ?? null,
    currentWeight: latestWeight,
    proteinTarget,
    calorieTarget,
  };
}
