import type { Href } from 'expo-router';

import type { UserProfile, UserRole } from '@/types/user';

export type SuperAdminViewMode = 'admin' | 'patient';

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
  superAdminViewMode: SuperAdminViewMode = 'admin',
): Href {
  if (profile.role === 'super_admin') {
    if (!patientOnboardingComplete) {
      return '/(auth)/onboarding/welcome';
    }
    return '/patient/home' as Href;
  }
  if (isProviderFacingRole(profile.role)) {
    return '/provider/dashboard';
  }
  if (isPatientFacingRole(profile.role)) {
    if (!patientOnboardingComplete) {
      if (profile.role === 'clinic_patient') {
        return '/patient/clinic-onboarding' as Href;
      }
      return '/(auth)/onboarding/welcome';
    }
    return '/patient/home' as Href;
  }
  return '/patient/dashboard';
}

export function canUsePatientSurface(
  profile: UserProfile,
  superAdminViewMode: SuperAdminViewMode = 'admin',
): boolean {
  return isPatientFacingRole(profile.role) || profile.role === 'super_admin';
}
