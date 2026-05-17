import { logAIAudit } from '@/lib/aiAudit';
import { canUseGlp1PatientFeatures } from '@/lib/consumerTier';
import { fetchPatientGoals, type PrimaryGoalId } from '@/lib/patientGoals';
import { fetchPatientMetabolicRow } from '@/lib/patientMetabolicProfile';
import { fetchPatientNutritionTargets, mergeNutritionOverrides } from '@/lib/patientNutritionTargets';
import {
  computeMacroPlan,
  pickGoalWeightLb,
  pickReferenceWeightLb,
} from '@/lib/nutritionMacroTargets';
import { fetchPatientWeightsForMacros } from '@/lib/nutritionCoachContext';
import { supabase } from '@/lib/supabase';
import { fetchTrainingLogs } from '@/lib/trainingLogs';
import { toPounds } from '@/lib/weightLogs';
import type { UserProfile } from '@/types/user';

const STALL_KEYS =
  /stall|plateau|stuck|not losing|stopped losing|no progress|weight not budging|not budging|can't lose|cannot lose/i;

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** If GLP-1 member voices a plateau with good protein + training, flag `ai_audit_log` for Simi (no dose advice in-app). */
export async function maybeFlagGlp1DoseReviewForSimi(params: {
  patientId: string | null;
  clinicId: string | null;
  profile: UserProfile | null;
  userMessage: string;
  sessionId: string | null;
}): Promise<void> {
  const { patientId, clinicId, profile, userMessage, sessionId } = params;
  if (!patientId || !canUseGlp1PatientFeatures(profile)) return;
  if (!STALL_KEYS.test(userMessage)) return;

  const today = new Date().toISOString().slice(0, 10);
  const from = addDays(today, -14);

  const [{ data: foods }, { data: wlogs }, goalsRow, weights, metabolic, training] = await Promise.all([
    supabase
      .from('food_log_entries')
      .select('log_date, protein_g')
      .eq('patient_id', patientId)
      .eq('entry_type', 'actual')
      .gte('log_date', from)
      .lte('log_date', today),
    supabase
      .from('weight_logs')
      .select('weight_value, unit, log_date')
      .eq('patient_id', patientId)
      .gte('log_date', from)
      .lte('log_date', today)
      .order('log_date', { ascending: true }),
    fetchPatientGoals(patientId),
    fetchPatientWeightsForMacros(patientId),
    fetchPatientMetabolicRow(patientId),
    fetchTrainingLogs(patientId, 30),
  ]);

  const trainingSessions = training.filter((l) => l.workout_date >= from).length;
  if (trainingSessions < 3) return;

  const byDay = new Map<string, number>();
  for (const row of foods ?? []) {
    const k = String((row as { log_date: string }).log_date);
    byDay.set(k, (byDay.get(k) ?? 0) + Number((row as { protein_g: number | null }).protein_g ?? 0));
  }
  const proteinDays = [...byDay.values()].filter((v) => v > 0).length;
  if (proteinDays < 8) return;

  const refLb = pickReferenceWeightLb({
    goalWeightFromGoals: goalsRow?.target_weight != null ? Number(goalsRow.target_weight) : null,
    patientGoalWeightLbs: weights.patientGoalWeightLbs,
    latestLoggedWeightLbs: weights.latestLoggedWeightLbs,
  });
  const goalLb = pickGoalWeightLb({
    goalWeightFromGoals: goalsRow?.target_weight != null ? Number(goalsRow.target_weight) : null,
    patientGoalWeightLbs: weights.patientGoalWeightLbs,
    referenceBodyLb: refLb,
  });
  const bodyLb = weights.latestLoggedWeightLbs ?? goalLb ?? refLb;
  const primary = goalsRow?.primary_goal as PrimaryGoalId | undefined;
  const metabolicForPlan =
    metabolic != null
      ? {
          heightInches: metabolic.height_inches,
          dateOfBirth: metabolic.date_of_birth,
          ageYearsSnapshot: metabolic.age,
          biologicalSex: metabolic.biological_sex,
          legacySex: metabolic.sex,
          activityLevel: metabolic.activity_level,
        }
      : null;
  const computed = computeMacroPlan({
    primaryGoal: primary,
    bodyWeightLb: bodyLb,
    goalWeightLb: goalLb,
    metabolic: metabolicForPlan,
    isGlp1Program: true,
    daysUntilStageShow: null,
  });
  const nutritionOverrides = await fetchPatientNutritionTargets(patientId);
  const { effective } = mergeNutritionOverrides(
    {
      calories: computed.calories,
      protein: computed.protein_g,
      carbs: computed.carbs_g,
      fat: computed.fat_g,
    },
    nutritionOverrides,
  );

  const avgProtein =
    proteinDays > 0 ? [...byDay.values()].reduce((a, b) => a + b, 0) / Math.max(1, proteinDays) : 0;
  if (avgProtein < effective.protein * 0.88) return;

  const wl = (wlogs ?? []) as { weight_value: number; unit: string; log_date: string }[];
  if (wl.length < 2) return;
  const first = toPounds(Number(wl[0]!.weight_value), wl[0]!.unit === 'kg' ? 'kg' : 'lb');
  const last = toPounds(Number(wl[wl.length - 1]!.weight_value), wl[wl.length - 1]!.unit === 'kg' ? 'kg' : 'lb');
  const deltaLb = last - first;
  const pct = (deltaLb / Math.max(1, last)) * 100;
  if (pct < -1.8 || pct > 0.4) return;

  const content = `[System] GLP-1 dose review candidate: member language suggests plateau; protein ~${Math.round(avgProtein)}g/day vs ~${effective.protein}g target; ${trainingSessions} training sessions / 14d; weight change ~${deltaLb.toFixed(1)} lb / 14d. Per protocol, consider discussing GLP-1 dose with Simi at next visit—no in-app dose changes.`;

  await logAIAudit({
    patientId,
    clinicId,
    sessionId,
    role: 'assistant',
    content,
    flaggedForReview: true,
    flagReason: 'glp1_dose_review_candidate',
    triggerDetected: true,
    triggerCategory: 'glp1_dose_escalation_hint',
  });
}
