import { mergeServerUserProfileRow } from '@/lib/authProfileMerge';
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

/** Persists `ui_mode`; self-guided layout is stored as `'explorer'`. */
export async function setUserUiMode(
  authUserId: string,
  mode: 'guided' | 'explorer',
): Promise<{ error: Error | null }> {
  const { data: updated, error } = await supabase
    .from('user_profiles')
    .update({
      ui_mode: mode,
      ui_mode_set_at: new Date().toISOString(),
    })
    .eq('auth_user_id', authUserId)
    .select('*')
    .maybeSingle();

  if (error) return { error: new Error(error.message) };
  if (!updated) return { error: new Error('Profile not updated') };
  mergeServerUserProfileRow(updated as Record<string, unknown>);
  return { error: null };
}

export async function fetchOnboardingContext(patientId: string): Promise<{
  clinic_connection: 'clinic_patient' | 'consumer' | 'unsure' | null;
  is_glp1_patient: boolean | null;
} | null> {
  const { data, error } = await supabase
    .from('patient_onboarding_context')
    .select('clinic_connection, is_glp1_patient')
    .eq('patient_id', patientId)
    .maybeSingle();
  if (error) {
    console.warn('[SonaLife] fetchOnboardingContext', error.message);
    return null;
  }
  return (data as { clinic_connection: 'clinic_patient' | 'consumer' | 'unsure' | null; is_glp1_patient: boolean | null } | null) ?? null;
}

export async function setConsumerTierAndTrack(
  authUserId: string,
  patientId: string,
  input: {
    tier: 'free' | 'core' | 'glp1_plus';
    track: 'hormone_optimization' | 'fitness_recomp' | 'wellness';
  },
): Promise<{ error: Error | null }> {
  const { error: pErr } = await supabase
    .from('user_profiles')
    .update({
      consumer_tier: input.tier,
      wellness_track: input.track,
    })
    .eq('auth_user_id', authUserId);
  if (pErr) return { error: new Error(pErr.message) };

  const { error: oErr } = await supabase
    .from('patient_onboarding_context')
    .update({ non_glp1_track: input.track })
    .eq('patient_id', patientId);
  if (oErr) return { error: new Error(oErr.message) };
  return { error: null };
}

export async function updateConsumerTierOnly(
  authUserId: string,
  tier: 'free' | 'core' | 'glp1_plus',
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('user_profiles').update({ consumer_tier: tier }).eq('auth_user_id', authUserId);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}
