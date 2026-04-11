import type { Href } from 'expo-router';

import type { UserProfile, UserRole } from '@/types/user';

export function isPatientFacingRole(role: UserRole): boolean {
  return role === 'clinic_patient' || role === 'consumer';
}

export function isProviderFacingRole(role: UserRole): boolean {
  return role === 'provider' || role === 'clinic_owner';
}

/** Maps app role to dashboard route (brief §4 + schema §13f). */
export function getPostAuthHref(
  profile: UserProfile,
  patientOnboardingComplete: boolean,
): Href {
  if (profile.role === 'super_admin') {
    return '/admin/command';
  }
  if (isProviderFacingRole(profile.role)) {
    return '/provider/dashboard';
  }
  if (isPatientFacingRole(profile.role)) {
    if (!patientOnboardingComplete) {
      return '/(auth)/onboarding/welcome';
    }
    return profile.ui_mode === 'guided' ? '/patient/guided-home' : '/patient/dashboard';
  }
  return '/patient/dashboard';
}
