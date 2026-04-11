import type { User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { UserProfile } from '@/types/user';

export async function syncAuthProfile(user: User | null): Promise<void> {
  if (!user) {
    useAuthStore.getState().reset();
    useAuthStore.getState().setProfileReady(true);
    return;
  }

  useAuthStore.getState().setProfileReady(false);

  const { data: profile, error } = await supabase
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
