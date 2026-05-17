import { supabase } from '@/lib/supabase';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';

export const PRIMARY_GOAL_IDS = [
  'lose_body_fat',
  'build_muscle_recomp',
  'stage_ready',
  'health_longevity',
  'glp1_journey',
  'unsure',
] as const;
export type PrimaryGoalId = (typeof PRIMARY_GOAL_IDS)[number];

export const HAS_TARGET_IDS = [
  'specific_numbers',
  'timeline_no_number',
  'no_specific_target',
  'feel_better_not_look',
] as const;
export type HasTargetId = (typeof HAS_TARGET_IDS)[number];

export const COACHING_FREQUENCY_IDS = [
  'every_step',
  'few_times_week',
  'weekly_summary',
  'just_when_needed',
  'coach_decides',
] as const;
export type CoachingFrequencyId = (typeof COACHING_FREQUENCY_IDS)[number];

export const EXPERIENCE_LEVEL_IDS = [
  'beginner',
  'returning',
  'intermediate',
  'advanced',
] as const;
export type ExperienceLevelId = (typeof EXPERIENCE_LEVEL_IDS)[number];

export const TRAINING_PHASE_IDS = ['cut', 'bulk', 'maintain', 'stage_prep', 'recomp'] as const;
export type TrainingPhaseId = (typeof TRAINING_PHASE_IDS)[number];

export type PatientGoalsRow = {
  id: string;
  patient_id: string;
  primary_goal: PrimaryGoalId;
  has_target: HasTargetId;
  target_weight: number | null;
  target_body_fat_pct: number | null;
  target_date: string | null;
  coaching_frequency: CoachingFrequencyId;
  experience_level: ExperienceLevelId;
  additional_notes: string | null;
  training_phase: TrainingPhaseId | null;
  phase_started_at: string | null;
  phase_target_end: string | null;
  phase_macro_adjustments: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export const PRIMARY_GOAL_LABELS: Record<PrimaryGoalId, string> = {
  lose_body_fat: 'Lose body fat',
  build_muscle_recomp: 'Build muscle / body recomposition',
  stage_ready: 'Get stage ready / competitive',
  health_longevity: 'Improve overall health and longevity',
  glp1_journey: 'Feel better on my GLP-1 journey',
  unsure: "I'm not sure yet — help me figure it out",
};

export const HAS_TARGET_LABELS: Record<HasTargetId, string> = {
  specific_numbers: 'Yes — let me enter a number',
  timeline_no_number: 'I have a timeline but no specific number',
  no_specific_target: 'No specific target, just consistent progress',
  feel_better_not_look: 'I want to feel better, not just look different',
};

export const COACHING_FREQUENCY_LABELS: Record<CoachingFrequencyId, string> = {
  every_step: 'Every step of the way — daily check-ins and constant guidance',
  few_times_week: 'A few times a week — regular but not overwhelming',
  weekly_summary: 'Weekly — give me a summary and let me run',
  just_when_needed: 'Just be there when I need you',
  coach_decides: 'You decide what I need',
};

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevelId, string> = {
  beginner: 'Complete beginner',
  returning: 'Some experience, getting back into it',
  intermediate: "Intermediate — I know what I'm doing",
  advanced: 'Advanced / competitive',
};

export function hasGoalSetup(row: PatientGoalsRow | null): boolean {
  return Boolean(row?.primary_goal);
}

export async function fetchPatientGoals(patientId: string): Promise<PatientGoalsRow | null> {
  const { data, error } = await supabase
    .from('patient_goals')
    .select('*')
    .eq('patient_id', patientId)
    .maybeSingle();
  if (error || !data) return null;
  const r = data as Record<string, unknown>;
  return {
    ...(data as PatientGoalsRow),
    training_phase: (r.training_phase as PatientGoalsRow['training_phase']) ?? null,
    phase_started_at: r.phase_started_at != null ? String(r.phase_started_at) : null,
    phase_target_end: r.phase_target_end != null ? String(r.phase_target_end) : null,
    phase_macro_adjustments:
      r.phase_macro_adjustments && typeof r.phase_macro_adjustments === 'object'
        ? (r.phase_macro_adjustments as Record<string, unknown>)
        : null,
  };
}

export async function fetchPatientGoalsForAuthUser(authUserId: string): Promise<PatientGoalsRow | null> {
  const pid = await fetchPatientIdForAuthUser(authUserId);
  if (!pid) return null;
  return fetchPatientGoals(pid);
}

export type PatientGoalsUpsert = {
  patientId: string;
  primary_goal: PrimaryGoalId;
  has_target: HasTargetId;
  target_weight: number | null;
  target_body_fat_pct: number | null;
  target_date: string | null;
  coaching_frequency: CoachingFrequencyId;
  experience_level: ExperienceLevelId;
  additional_notes: string | null;
};

export async function upsertPatientGoals(input: PatientGoalsUpsert): Promise<{ error: string | null }> {
  const now = new Date().toISOString();
  const { error } = await supabase.from('patient_goals').upsert(
    {
      patient_id: input.patientId,
      primary_goal: input.primary_goal,
      has_target: input.has_target,
      target_weight: input.target_weight,
      target_body_fat_pct: input.target_body_fat_pct,
      target_date: input.target_date,
      coaching_frequency: input.coaching_frequency,
      experience_level: input.experience_level,
      additional_notes: input.additional_notes,
      updated_at: now,
    },
    { onConflict: 'patient_id' },
  );
  return { error: error?.message ?? null };
}

export async function updatePatientTrainingPhase(input: {
  patientId: string;
  training_phase: TrainingPhaseId | null;
  phase_started_at: string | null;
  phase_target_end: string | null;
  phase_macro_adjustments: Record<string, unknown> | null;
}): Promise<{ error: string | null }> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('patient_goals')
    .update({
      training_phase: input.training_phase,
      phase_started_at: input.phase_started_at,
      phase_target_end: input.phase_target_end,
      phase_macro_adjustments: input.phase_macro_adjustments ?? {},
      updated_at: now,
    })
    .eq('patient_id', input.patientId);
  return { error: error?.message ?? null };
}

/** Days from local "today" until target_date (non-negative), or null if no date. */
export function daysUntilTargetDate(targetDateIso: string | null | undefined): number | null {
  if (!targetDateIso) return null;
  const end = new Date(`${targetDateIso}T12:00:00`);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const ms = end.getTime() - start.getTime();
  const d = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return Number.isFinite(d) ? Math.max(0, d) : null;
}
