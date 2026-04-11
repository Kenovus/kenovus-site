import { supabase } from '@/lib/supabase';
import type { PatientOnboardingContextRow } from '@/types/onboarding';

export async function fetchPatientIdForAuthUser(authUserId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('patients')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (error) {
    console.warn('[SonaLife] fetchPatientIdForAuthUser', error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function upsertOnboardingContext(
  row: PatientOnboardingContextRow,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('patient_onboarding_context').upsert(row, {
    onConflict: 'patient_id',
  });

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function updatePatientDemographics(
  patientId: string,
  fields: {
    first_name: string;
    last_name: string;
    date_of_birth: string;
    sex: 'male' | 'female' | 'other' | 'prefer_not';
  },
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('patients').update(fields).eq('id', patientId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function setPatientOnboardingComplete(
  patientId: string,
  complete: boolean,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('patients')
    .update({ onboarding_complete: complete })
    .eq('id', patientId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function setUserUiMode(
  authUserId: string,
  mode: 'guided' | 'explorer',
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('user_profiles')
    .update({
      ui_mode: mode,
      ui_mode_set_at: new Date().toISOString(),
    })
    .eq('auth_user_id', authUserId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}
