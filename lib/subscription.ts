/**
 * PART 6 — Subscription / Entitlement system.
 * BETA POLICY: clinic_patient gets FULL ACCESS to everything at no cost.
 * RevenueCat infrastructure ready but all entitlements return TRUE for clinic patients.
 */
import type { UserProfile } from '@/types/user';

// ── Entitlement IDs (match RevenueCat dashboard) ──────────────────────────────
export const ENTITLEMENTS = {
  UNLIMITED_SONA: 'unlimited_sona',
  FOOD_LOGGING: 'food_logging',
  PROGRESS_TRACKING: 'progress_tracking',
  SCAN: 'scan',
  WEARABLES: 'wearables',
  CLINICAL_AI: 'clinical_ai',
  GLP1_PROGRAM: 'glp1_program',
} as const;

export type EntitlementId = (typeof ENTITLEMENTS)[keyof typeof ENTITLEMENTS];

// ── Tier definitions ──────────────────────────────────────────────────────────
export const TIERS = {
  free: {
    label: 'Free',
    price: '$0',
    entitlements: [ENTITLEMENTS.FOOD_LOGGING],
    sonaMessagesPerDay: 10,
  },
  core: {
    label: 'Core',
    price: '$19.99/mo',
    entitlements: [ENTITLEMENTS.UNLIMITED_SONA, ENTITLEMENTS.FOOD_LOGGING, ENTITLEMENTS.PROGRESS_TRACKING],
    sonaMessagesPerDay: Infinity,
  },
  glp1_plus: {
    label: 'GLP-1+',
    price: '$29.99/mo',
    entitlements: Object.values(ENTITLEMENTS),
    sonaMessagesPerDay: Infinity,
  },
  clinic: {
    label: 'Sona Patient',
    price: 'Complimentary',
    entitlements: Object.values(ENTITLEMENTS),  // FULL ACCESS during beta
    sonaMessagesPerDay: Infinity,
  },
} as const;

// ── CRITICAL: Beta override — clinic patients get everything free ──────────────
function isClinicPatient(profile: UserProfile | null): boolean {
  return profile?.role === 'clinic_patient';
}

/** Check a specific entitlement. Clinic patients always get TRUE. */
export function hasEntitlement(
  profile: UserProfile | null,
  entitlement: EntitlementId,
): boolean {
  // BETA POLICY: clinic patients have full access to everything
  if (isClinicPatient(profile)) return true;

  const tier = (profile as { consumer_tier?: string } | null)?.consumer_tier ?? 'free';
  const tierDef = TIERS[tier as keyof typeof TIERS] ?? TIERS.free;
  return tierDef.entitlements.includes(entitlement as never);
}

/** Daily Sona message cap. Clinic patients: unlimited. */
export function getSonaMessageCap(profile: UserProfile | null): number {
  if (isClinicPatient(profile)) return Infinity;
  const tier = (profile as { consumer_tier?: string } | null)?.consumer_tier ?? 'free';
  return TIERS[tier as keyof typeof TIERS]?.sonaMessagesPerDay ?? 10;
}

/** Returns true if patient should see paywall for a feature. */
export function shouldShowPaywall(profile: UserProfile | null, entitlement: EntitlementId): boolean {
  return !hasEntitlement(profile, entitlement);
}

// ── RevenueCat (placeholder — wire in when RC SDK installed) ─────────────────
export async function initRevenueCat(userId: string): Promise<void> {
  // TODO: when @revenuecat/purchases-react-native is installed:
  // await Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY!, appUserID: userId });
  // Clinic patients: await Purchases.setAttributes({ clinic_patient: 'true' });
  console.log('[RevenueCat] placeholder init for user:', userId);
}

export async function checkRevenueCatEntitlements(): Promise<Record<string, boolean>> {
  // TODO: const customerInfo = await Purchases.getCustomerInfo();
  // return Object.fromEntries(Object.keys(customerInfo.entitlements.active).map(k => [k, true]));
  return {};
}

export async function purchasePackage(packageId: string): Promise<{ success: boolean; error: string | null }> {
  // TODO: const offerings = await Purchases.getOfferings();
  // const pkg = offerings.current?.availablePackages.find(p => p.identifier === packageId);
  // if (!pkg) return { success: false, error: 'Package not found' };
  // await Purchases.purchasePackage(pkg);
  return { success: false, error: 'RevenueCat not yet configured' };
}
