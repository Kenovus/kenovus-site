import type { UserProfile } from '@/types/user';

/** In-app shape collected during onboarding conversation (brief §11g). */
export interface OnboardingConversationAnswers {
  past_struggle: string;
  success_definition: string;
  readiness_score: number;
  is_glp1_patient: boolean | null;
  glp1_medication: string | null;
  glp1_dose: string | null;
  clinic_connection: 'clinic_patient' | 'consumer' | 'unsure';
  commitment_response: string;
}

export type ClinicConnection = OnboardingConversationAnswers['clinic_connection'];

/** Row shape for `patient_onboarding_context` (brief §11g). */
export type PatientOnboardingContextRow = {
  patient_id: string;
  past_struggle: string | null;
  success_definition: string | null;
  readiness_score: number | null;
  commitment_response: string | null;
  is_glp1_patient: boolean | null;
  glp1_medication: string | null;
  glp1_dose: string | null;
  clinic_connection: ClinicConnection | null;
  completed_at?: string;
};

export function normalizeUiMode(profile: UserProfile | null): 'guided' | 'explorer' {
  return profile?.ui_mode === 'guided' ? 'guided' : 'explorer';
}
