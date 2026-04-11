import type { Href } from 'expo-router';

import { getPostAuthHref } from '@/lib/authRouting';
import type { UserProfile } from '@/types/user';

export function hrefForProfile(profile: UserProfile, onboardingComplete: boolean): Href {
  return getPostAuthHref(profile, onboardingComplete);
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
