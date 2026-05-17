import type { UserProfile, UserRole } from '@/types/user';

export type ConsumerTier = 'free' | 'core' | 'glp1_plus';

export function normalizeConsumerTier(profile: UserProfile | null): ConsumerTier {
  const t = profile?.consumer_tier;
  if (t === 'core' || t === 'glp1_plus') return t;
  return 'free';
}

export function isConsumer(profile: UserProfile | null): boolean {
  return profile?.role === 'consumer';
}

/** Max user → coach messages per UTC day that may reach the model (brief §11d). Clinic patients: unlimited. */
export function getDailyAiUserMessageCap(profile: UserProfile | null): number {
  if (!profile || profile.role !== 'consumer') return Number.POSITIVE_INFINITY;
  const tier = normalizeConsumerTier(profile);
  if (tier === 'glp1_plus') return Number.POSITIVE_INFINITY;
  if (tier === 'core') return 30;
  return 5;
}

export function canSyncWearables(profile: UserProfile | null): boolean {
  if (!profile) return false;
  if (profile.role !== 'consumer') return true;
  return normalizeConsumerTier(profile) !== 'free';
}

/** GLP-1 symptom check-in + injection checklist extras (brief §11d GLP-1+). */
export function canUseGlp1PatientFeatures(profile: UserProfile | null): boolean {
  if (!profile) return false;
  if (profile.role === 'clinic_patient') return true;
  if (profile.role === 'consumer') return normalizeConsumerTier(profile) === 'glp1_plus';
  return false;
}

/** Progress photos (4-angle) — GLP-1+ consumer or any clinic patient. */
export function canUseProgressPhotos(profile: UserProfile | null): boolean {
  if (!profile) return false;
  if (profile.role === 'clinic_patient') return true;
  if (profile.role === 'consumer') return normalizeConsumerTier(profile) === 'glp1_plus';
  return false;
}

/** Barcode scan, saved meals, full nutrition features (brief: Core+). */
export function canUseNutritionPremium(profile: UserProfile | null): boolean {
  if (!profile) return true;
  if (profile.role !== 'consumer') return true;
  return normalizeConsumerTier(profile) !== 'free';
}
