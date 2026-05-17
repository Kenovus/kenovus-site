import { supabase } from '@/lib/supabase';

export type MacroGoalsNumbers = { calories: number; protein: number; carbs: number; fat: number };

export type PatientNutritionTargetsRow = {
  patient_id: string;
  protein_override_g: number | null;
  carbs_override_g: number | null;
  fat_override_g: number | null;
  calories_override: number | null;
  updated_at?: string;
};

export type NutritionCustomFlags = {
  protein: boolean;
  carbs: boolean;
  fat: boolean;
  calories: boolean;
};

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function fetchPatientNutritionTargets(patientId: string): Promise<PatientNutritionTargetsRow | null> {
  const { data, error } = await supabase
    .from('patient_nutrition_targets')
    .select('*')
    .eq('patient_id', patientId)
    .maybeSingle();
  if (error) {
    console.warn('[patientNutritionTargets] fetch failed (migration applied?)', error.message);
    return null;
  }
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    patient_id: String(r.patient_id),
    protein_override_g: numOrNull(r.protein_override_g),
    carbs_override_g: numOrNull(r.carbs_override_g),
    fat_override_g: numOrNull(r.fat_override_g),
    calories_override: numOrNull(r.calories_override),
    updated_at: r.updated_at != null ? String(r.updated_at) : undefined,
  };
}

export function mergeNutritionOverrides(
  recommended: MacroGoalsNumbers,
  row: PatientNutritionTargetsRow | null,
): { effective: MacroGoalsNumbers; custom: NutritionCustomFlags } {
  const custom: NutritionCustomFlags = {
    protein: row?.protein_override_g != null,
    carbs: row?.carbs_override_g != null,
    fat: row?.fat_override_g != null,
    calories: row?.calories_override != null,
  };
  return {
    effective: {
      protein: custom.protein ? Math.round(Number(row!.protein_override_g)) : recommended.protein,
      carbs: custom.carbs ? Math.round(Number(row!.carbs_override_g)) : recommended.carbs,
      fat: custom.fat ? Math.round(Number(row!.fat_override_g)) : recommended.fat,
      calories: custom.calories ? Math.round(Number(row!.calories_override)) : recommended.calories,
    },
    custom,
  };
}

export function hasAnyNutritionCustom(custom: NutritionCustomFlags): boolean {
  return custom.protein || custom.carbs || custom.fat || custom.calories;
}

/** Keeps `patient_macro_goals` aligned with the plan the member sees (checklist protein line, etc.). */
export async function syncPatientMacroGoalsFromEffective(
  patientId: string,
  effective: MacroGoalsNumbers,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('patient_macro_goals').upsert(
    {
      patient_id: patientId,
      calories_goal: effective.calories,
      protein_goal_g: effective.protein,
      carbs_goal_g: effective.carbs,
      fat_goal_g: effective.fat,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'patient_id' },
  );
  return { error: error?.message ?? null };
}

export async function upsertPatientNutritionTargets(
  patientId: string,
  next: {
    protein_override_g: number | null;
    carbs_override_g: number | null;
    fat_override_g: number | null;
    calories_override: number | null;
  },
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('patient_nutrition_targets').upsert(
    {
      patient_id: patientId,
      protein_override_g: next.protein_override_g,
      carbs_override_g: next.carbs_override_g,
      fat_override_g: next.fat_override_g,
      calories_override: next.calories_override,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'patient_id' },
  );
  return { error: error?.message ?? null };
}

export async function setNutritionOverrideField(
  patientId: string,
  field: 'protein' | 'carbs' | 'fat' | 'calories',
  value: number | null,
): Promise<{ error: string | null }> {
  const existing = await fetchPatientNutritionTargets(patientId);
  const next = {
    protein_override_g: existing?.protein_override_g ?? null,
    carbs_override_g: existing?.carbs_override_g ?? null,
    fat_override_g: existing?.fat_override_g ?? null,
    calories_override: existing?.calories_override ?? null,
  };
  if (field === 'protein') next.protein_override_g = value;
  if (field === 'carbs') next.carbs_override_g = value;
  if (field === 'fat') next.fat_override_g = value;
  if (field === 'calories') next.calories_override = value;
  return upsertPatientNutritionTargets(patientId, next);
}

export async function resetPatientNutritionOverrides(patientId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('patient_nutrition_targets').delete().eq('patient_id', patientId);
  return { error: error?.message ?? null };
}
