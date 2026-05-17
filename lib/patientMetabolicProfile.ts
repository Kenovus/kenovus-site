import { supabase } from '@/lib/supabase';
import {
  computeMacroPlan,
  pickGoalWeightLb,
  pickReferenceWeightLb,
  type ActivityLevelId,
  type BiologicalSexForBmr,
} from '@/lib/nutritionMacroTargets';
import { fetchPatientGoals, type PrimaryGoalId } from '@/lib/patientGoals';
import { fetchLatestWeightLbs } from '@/lib/weightLogs';

export type PatientMetabolicRow = {
  date_of_birth: string | null;
  height_inches: number | null;
  sex: string | null;
  biological_sex: BiologicalSexForBmr | null;
  age: number | null;
  activity_level: ActivityLevelId | null;
  tdee_kcal: number | null;
  goal_weight_lbs: number | null;
};

export async function fetchPatientMetabolicRow(patientId: string): Promise<PatientMetabolicRow | null> {
  const { data, error } = await supabase
    .from('patients')
    .select('date_of_birth, height_inches, sex, biological_sex, age, activity_level, tdee_kcal, goal_weight_lbs')
    .eq('id', patientId)
    .maybeSingle();
  if (error || !data) return null;
  const r = data as Record<string, unknown>;
  return {
    date_of_birth: r.date_of_birth != null ? String(r.date_of_birth) : null,
    height_inches: r.height_inches != null ? Number(r.height_inches) : null,
    sex: r.sex != null ? String(r.sex) : null,
    biological_sex: (r.biological_sex as BiologicalSexForBmr | null) ?? null,
    age: r.age != null ? Number(r.age) : null,
    activity_level: (r.activity_level as ActivityLevelId | null) ?? null,
    tdee_kcal: r.tdee_kcal != null ? Number(r.tdee_kcal) : null,
    goal_weight_lbs: r.goal_weight_lbs != null ? Number(r.goal_weight_lbs) : null,
  };
}

export async function updatePatientMetabolicFields(
  patientId: string,
  fields: {
    date_of_birth?: string | null;
    height_inches?: number | null;
    biological_sex?: BiologicalSexForBmr | null;
    age?: number | null;
    activity_level?: ActivityLevelId | null;
  },
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('patients').update(fields).eq('id', patientId);
  return { error: error?.message ?? null };
}

/** Recompute maintenance TDEE from latest weight + demographics and persist `patients.tdee_kcal`. */
export async function recomputeAndPersistPatientTdee(patientId: string): Promise<{ error: string | null; tdee: number | null }> {
  const [row, goalsRow, latestLb] = await Promise.all([
    fetchPatientMetabolicRow(patientId),
    fetchPatientGoals(patientId),
    fetchLatestWeightLbs(patientId),
  ]);
  if (!row) return { error: 'no patient', tdee: null };

  const refLb = pickReferenceWeightLb({
    goalWeightFromGoals: goalsRow?.target_weight != null ? Number(goalsRow.target_weight) : null,
    patientGoalWeightLbs: row.goal_weight_lbs,
    latestLoggedWeightLbs: latestLb,
  });
  const goalLb = pickGoalWeightLb({
    goalWeightFromGoals: goalsRow?.target_weight != null ? Number(goalsRow.target_weight) : null,
    patientGoalWeightLbs: row.goal_weight_lbs,
    referenceBodyLb: refLb,
  });
  const bodyLb = latestLb ?? goalLb ?? refLb;

  const plan = computeMacroPlan({
    primaryGoal: goalsRow?.primary_goal as PrimaryGoalId | null | undefined,
    bodyWeightLb: bodyLb,
    goalWeightLb: goalLb,
    metabolic: {
      heightInches: row.height_inches,
      dateOfBirth: row.date_of_birth,
      ageYearsSnapshot: row.age,
      biologicalSex: row.biological_sex,
      legacySex: row.sex,
      activityLevel: row.activity_level,
    },
    isGlp1Program: false,
    daysUntilStageShow: null,
  });

  const tdee = plan.tdee_maintenance_kcal;
  if (tdee == null) {
    await supabase.from('patients').update({ tdee_kcal: null }).eq('id', patientId);
    return { error: null, tdee: null };
  }
  const { error } = await supabase.from('patients').update({ tdee_kcal: Math.round(tdee * 10) / 10 }).eq('id', patientId);
  return { error: error?.message ?? null, tdee };
}
