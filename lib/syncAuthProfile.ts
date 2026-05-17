import type { User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { UserProfile } from '@/types/user';

async function maybePromoteConsumerFromClinicRoster(user: User, profile: Record<string, unknown>): Promise<boolean> {
  if (profile.role !== 'consumer') return false;
  const email = (user.email ?? (profile.email as string | null) ?? '').trim().toLowerCase();
  if (!email) return false;

  const { data: roster, error: rosterErr } = await supabase
    .from('patients')
    .select('id, clinic_id, auth_user_id')
    .ilike('email', email)
    .not('clinic_id', 'is', null)
    .maybeSingle();

  if (rosterErr || !roster?.clinic_id) return false;

  const { error } = await supabase
    .from('user_profiles')
    .update({
      role: 'clinic_patient',
      clinic_id: roster.clinic_id,
      primary_persona: 'clinic_patient',
    })
    .eq('auth_user_id', user.id);

  if (error) {
    console.warn('[SonaLife] clinic roster promotion failed', error.message);
    return false;
  }

  if (!roster.auth_user_id || roster.auth_user_id === user.id) {
    await supabase.from('patients').update({ auth_user_id: user.id }).eq('id', roster.id);
  }

  return true;
}

export type SyncAuthProfileOptions = {
  /** When true, do not flip profileReady off during fetch (avoids UI freeze / splash re-entry during in-session refreshes). */
  keepProfileReady?: boolean;
};

export async function syncAuthProfile(user: User | null, options?: SyncAuthProfileOptions): Promise<void> {
  if (!user) {
    useAuthStore.getState().reset();
    useAuthStore.getState().setProfileReady(true);
    return;
  }

  if (!options?.keepProfileReady) {
    useAuthStore.getState().setProfileReady(false);
  }

  let { data: profile, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (error) {
    console.warn('[SonaLife] user_profiles fetch failed', error.message);
    useAuthStore.getState().setProfile(null);
    useAuthStore.getState().setPatientOnboardingComplete(null);
    useAuthStore.getState().setProfileReady(true);
    return;
  }

  if (!profile) {
    const email = user.email ?? null;
    const fallbackName = email ? email.split('@')[0] : 'Consumer';
    const { error: pErr } = await supabase.from('user_profiles').insert({
      auth_user_id: user.id,
      role: 'consumer',
      full_name: fallbackName,
      email,
      ui_mode: null,
      wellness_track: 'wellness',
      consumer_tier: 'free',
    });
    if (!pErr) {
      const { data: profileCreated } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      profile = profileCreated;
    } else {
      console.warn('[SonaLife] auto-create user_profiles failed', pErr.message);
    }
  }

  if (profile) {
    const promoted = await maybePromoteConsumerFromClinicRoster(user, profile as Record<string, unknown>);
    if (promoted) {
      const { data: refreshed } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      if (refreshed) profile = refreshed;
    }
  }

  if (profile && (profile.role === 'consumer' || profile.role === 'clinic_patient')) {
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (!patient) {
      await supabase.from('patients').insert({
        auth_user_id: user.id,
        clinic_id: profile.clinic_id ?? null,
        first_name: profile.full_name?.split(/\s+/)[0] ?? 'New',
        last_name: profile.full_name?.split(/\s+/).slice(1).join(' ') ?? 'User',
        email: profile.email ?? user.email ?? `${user.id}@consumer.local`,
        onboarding_complete: false,
      });
    }
  }

  useAuthStore.getState().setProfile(profile as UserProfile | null);

  if (!profile) {
    useAuthStore.getState().setPatientOnboardingComplete(null);
    useAuthStore.getState().setProfileReady(true);
    return;
  }

  const role = profile.role as UserProfile['role'];
  if (role === 'clinic_patient' || role === 'consumer') {
    const { data: patient } = await supabase
      .from('patients')
      .select('onboarding_complete')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    useAuthStore.getState().setPatientOnboardingComplete(
      patient?.onboarding_complete === true,
    );
  } else {
    useAuthStore.getState().setPatientOnboardingComplete(null);
  }

  useAuthStore.getState().setProfileReady(true);
}
