import { supabase } from '@/lib/supabase';

export const TRAINING_STYLE_IDS = ['powerlifting', 'bodybuilding', 'athletic', 'general_fitness'] as const;
export type TrainingStyleId = (typeof TRAINING_STYLE_IDS)[number];

export const EQUIPMENT_IDS = ['full_gym', 'home_gym', 'minimal_bands', 'bodyweight_only'] as const;
export type EquipmentId = (typeof EQUIPMENT_IDS)[number];

export type PatientTrainingPrefsRow = {
  patient_id: string;
  training_days_per_week: number;
  training_style: TrainingStyleId;
  equipment: EquipmentId;
  updated_at: string;
};

export const TRAINING_STYLE_LABELS: Record<TrainingStyleId, string> = {
  powerlifting: 'Powerlifting',
  bodybuilding: 'Bodybuilding',
  athletic: 'Athletic / hybrid',
  general_fitness: 'General fitness',
};

export const EQUIPMENT_LABELS: Record<EquipmentId, string> = {
  full_gym: 'Full gym',
  home_gym: 'Home gym',
  minimal_bands: 'Minimal / bands only',
  bodyweight_only: 'Bodyweight only',
};

export async function fetchPatientTrainingPrefs(patientId: string): Promise<PatientTrainingPrefsRow | null> {
  const { data, error } = await supabase
    .from('patient_training_prefs')
    .select('*')
    .eq('patient_id', patientId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    patient_id: String(data.patient_id),
    training_days_per_week: Number(data.training_days_per_week),
    training_style: data.training_style as TrainingStyleId,
    equipment: data.equipment as EquipmentId,
    updated_at: String(data.updated_at),
  };
}

export async function upsertPatientTrainingPrefs(input: {
  patientId: string;
  training_days_per_week: number;
  training_style: TrainingStyleId;
  equipment: EquipmentId;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('patient_training_prefs').upsert(
    {
      patient_id: input.patientId,
      training_days_per_week: input.training_days_per_week,
      training_style: input.training_style,
      equipment: input.equipment,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'patient_id' },
  );
  return { error: error?.message ?? null };
}
