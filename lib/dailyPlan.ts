/**
 * Daily Plan Engine — computes today's personalised targets and focus actions.
 * Determines training day vs rest, adjusts calories, picks 2 focus actions.
 */
import { supabase } from '@/lib/supabase';
import { fetchPatientGoals } from '@/lib/patientGoals';
import { fetchPatientNutritionTargets } from '@/lib/patientNutritionTargets';
import { fetchFoodLogsForDate } from '@/lib/nutritionLogData';
import { fetchLatestWeightLbs } from '@/lib/weightLogs';
import { localDateKey } from '@/lib/patientSupplements';

export type TrainingFocus =
  | 'Upper Body'
  | 'Lower Body'
  | 'Full Body'
  | 'Cardio'
  | 'Rest Day'
  | 'Active Recovery';

export interface DailyPlan {
  date: string;
  isTrainingDay: boolean;
  trainingFocus: TrainingFocus;
  calorieTarget: number;
  proteinTarget: number;   // grams
  stepsTarget: number;
  focusActions: string[];  // 2 most important actions for today
  // Progress
  caloriesConsumed: number;
  proteinConsumed: number;
  currentWeightLbs: number | null;
  goalWeightLbs: number | null;
  daysOnProgram: number;
}

const TRAINING_ROTATION: TrainingFocus[] = [
  'Upper Body', 'Lower Body', 'Upper Body', 'Cardio', 'Full Body', 'Rest Day', 'Rest Day',
];

function getDayIndex(): number {
  const epoch = new Date('2024-01-01').getTime();
  return Math.floor((Date.now() - epoch) / 86400000) % 7;
}

function determineTrainingFocus(recentWorkouts: string[]): TrainingFocus {
  // Use rotation based on day of week (Mon=upper, Tue=lower, Wed=upper/cardio, Thu=cardio, Fri=full, Sat=rest, Sun=rest)
  const dayOfWeek = new Date().getDay(); // 0=Sun
  const map: Record<number, TrainingFocus> = {
    0: 'Rest Day',
    1: 'Upper Body',
    2: 'Lower Body',
    3: 'Upper Body',
    4: 'Cardio',
    5: 'Full Body',
    6: 'Active Recovery',
  };
  return map[dayOfWeek] ?? 'Rest Day';
}

function buildFocusActions(opts: {
  proteinConsumed: number;
  proteinTarget: number;
  caloriesConsumed: number;
  calorieTarget: number;
  isTrainingDay: boolean;
  trainingFocus: TrainingFocus;
  currentWeightLbs: number | null;
  goalWeightLbs: number | null;
}): string[] {
  const actions: string[] = [];
  const hour = new Date().getHours();

  // Protein gap (most important)
  const proteinLeft = Math.round(Math.max(0, opts.proteinTarget - opts.proteinConsumed));
  if (proteinLeft > 20) {
    const deadline = hour < 14 ? 'before 6pm' : 'tonight';
    actions.push(`Hit protein: ${proteinLeft}g still needed ${deadline}`);
  } else if (proteinLeft <= 20 && proteinLeft > 0) {
    actions.push(`Almost there on protein — ${proteinLeft}g to go`);
  } else {
    actions.push('Protein goal hit ✓ — keep it up');
  }

  // Training action
  if (opts.isTrainingDay && opts.trainingFocus !== 'Rest Day') {
    actions.push(`Complete ${opts.trainingFocus} training session today`);
  } else if (opts.trainingFocus === 'Rest Day') {
    actions.push('Rest day — prioritise sleep and recovery');
  } else {
    actions.push('30 min walk or light cardio to stay active');
  }

  // Weight trend nudge if close to goal
  if (opts.currentWeightLbs && opts.goalWeightLbs) {
    const gap = opts.currentWeightLbs - opts.goalWeightLbs;
    if (gap > 0 && gap < 5) {
      actions.push(`${gap.toFixed(1)} lbs from goal — don't stop now`);
    }
  }

  return actions.slice(0, 2);
}

export async function buildDailyPlan(patientId: string, userId: string): Promise<DailyPlan> {
  const today = localDateKey(new Date());

  const [goals, targets, todayFood, currentWeight, workoutToday] = await Promise.allSettled([
    fetchPatientGoals(patientId),
    fetchPatientNutritionTargets(patientId),
    fetchFoodLogsForDate(patientId, today),
    fetchLatestWeightLbs(patientId),
    supabase
      .from('training_logs')
      .select('id, training_style')
      .eq('patient_id', patientId)
      .eq('workout_date', today)
      .limit(1),
  ]);

  const goalData   = goals.status === 'fulfilled' ? goals.value : null;
  const targetData = targets.status === 'fulfilled' ? targets.value : null;
  const food       = todayFood.status === 'fulfilled' ? todayFood.value : [];
  const weight     = currentWeight.status === 'fulfilled' ? currentWeight.value : null;
  const todayLog   = workoutToday.status === 'fulfilled' ? workoutToday.value.data : [];

  const isTrainingDay = (todayLog ?? []).length > 0 || determineTrainingFocus([]) !== 'Rest Day';
  const trainingFocus = determineTrainingFocus([]);

  // Targets
  const baseCalories = targetData?.calories_override ?? 2000;
  const calorieTarget = isTrainingDay ? baseCalories + 200 : baseCalories;
  const proteinTarget = targetData?.protein_override_g ?? Math.round((weight ?? 180) * 1.0);
  const stepsTarget   = trainingFocus === 'Cardio' ? 12000 : isTrainingDay ? 10000 : 8000;

  // Totals consumed today
  const caloriesConsumed = Math.round(food.reduce((s, e) => s + (e.calories ?? 0), 0));
  const proteinConsumed  = Math.round(food.reduce((s, e) => s + (e.protein_g ?? 0), 0));

  // Days on program
  const { data: patientRow } = await supabase
    .from('patients')
    .select('created_at')
    .eq('id', patientId)
    .single();
  const daysOnProgram = patientRow?.created_at
    ? Math.floor((Date.now() - new Date(patientRow.created_at).getTime()) / 86400000)
    : 0;

  const focusActions = buildFocusActions({
    proteinConsumed, proteinTarget, caloriesConsumed, calorieTarget,
    isTrainingDay, trainingFocus,
    currentWeightLbs: weight,
    goalWeightLbs: null,
  });

  return {
    date: today,
    isTrainingDay,
    trainingFocus,
    calorieTarget,
    proteinTarget,
    stepsTarget,
    focusActions,
    caloriesConsumed,
    proteinConsumed,
    currentWeightLbs: weight,
    goalWeightLbs: null,
    daysOnProgram,
  };
}

/** Compute weeks to goal from weight trend */
export async function computeTimelineToGoal(patientId: string): Promise<{
  weeksToGoal: number | null;
  lbsPerWeek: number | null;
  goalWeightLbs: number | null;
  message: string;
}> {
  const [goals, recentWeights] = await Promise.allSettled([
    fetchPatientGoals(patientId),
    supabase
      .from('weight_logs')
      .select('weight_lbs, log_date')
      .eq('patient_id', patientId)
      .order('log_date', { ascending: false })
      .limit(28),
  ]);

  const goalData = goals.status === 'fulfilled' ? goals.value : null;
  const weights  = recentWeights.status === 'fulfilled' ? (recentWeights.value.data ?? []) : [];

  if (weights.length < 4) {
    return { weeksToGoal: null, lbsPerWeek: null, goalWeightLbs: null, message: 'Log at least 4 weight entries to see your timeline.' };
  }

  // Simple linear regression on weight vs date
  const entries = weights.map((w) => ({
    x: new Date(w.log_date).getTime() / (7 * 86400000), // weeks since epoch
    y: Number(w.weight_lbs),
  })).sort((a, b) => a.x - b.x);

  const n  = entries.length;
  const sx = entries.reduce((s, e) => s + e.x, 0);
  const sy = entries.reduce((s, e) => s + e.y, 0);
  const sxy = entries.reduce((s, e) => s + e.x * e.y, 0);
  const sxx = entries.reduce((s, e) => s + e.x * e.x, 0);
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx); // lbs per week
  const lbsPerWeek = Math.round(Math.abs(slope) * 10) / 10;

  const currentWeight = entries[entries.length - 1]?.y ?? null;
  const goalWeightLbs = null; // would come from goals

  if (!currentWeight || Math.abs(slope) < 0.01) {
    return { weeksToGoal: null, lbsPerWeek: 0, goalWeightLbs, message: 'Your weight has been stable this month.' };
  }

  const direction = slope < 0 ? 'losing' : 'gaining';
  const rate = `${lbsPerWeek} lbs/week`;

  if (!goalWeightLbs) {
    return {
      weeksToGoal: null, lbsPerWeek: slope,
      goalWeightLbs: null,
      message: `You're ${direction} weight at ~${rate}. Set a goal weight to see your timeline.`,
    };
  }

  const lbsToGo = Math.abs(currentWeight - goalWeightLbs);
  const weeksToGoal = Math.round(lbsToGo / Math.abs(slope));

  return {
    weeksToGoal,
    lbsPerWeek: slope,
    goalWeightLbs,
    message: `At your current pace (~${rate}), you'll reach your goal in approximately ${weeksToGoal} weeks.`,
  };
}
