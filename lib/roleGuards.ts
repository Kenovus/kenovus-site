import type { Href } from 'expo-router';

import { getPostAuthHref } from '@/lib/authRouting';
import type { UserProfile } from '@/types/user';

export function hrefForProfile(
  profile: UserProfile,
  onboardingComplete: boolean,
  superAdminViewMode: 'admin' | 'patient' = 'admin',
): Href {
  return getPostAuthHref(profile, onboardingComplete, superAdminViewMode);
}

export function patientOnboardingDone(
  profile: UserProfile,
  patientOnboardingComplete: boolean | null,
): boolean {
  return (
    profile.role !== 'clinic_patient' && profile.role !== 'consumer'
      ? true
      : patientOnboardingComplete === true
  );
}
