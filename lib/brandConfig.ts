/**
 * PART 7 — Brand configuration.
 * clinic_id present → SonaLife branded clinic experience
 * clinic_id null   → Kenovus consumer experience
 * Same codebase, different config pulled from Supabase.
 */

export interface BrandConfig {
  appName: string;
  clinicName: string;
  aiCoachName: string;
  primaryColor: string;
  accentColor: string;
  logoKey: 'sona' | 'kenovus';
  tagline: string;
  focusAreas: ('glp1' | 'aesthetics' | 'nutrition' | 'fitness' | 'longevity' | 'skincare')[];
  subscriptionRequired: boolean;
  treatmentBookingUrl: string | null;
}

export const SONA_CONFIG: BrandConfig = {
  appName: 'SonaLife',
  clinicName: 'Sona Medical Aesthetics',
  aiCoachName: 'Sona',
  primaryColor: '#BF8D36',
  accentColor: '#BF8D36',
  logoKey: 'sona',
  tagline: 'Rooted in beauty. Guided by science.',
  focusAreas: ['glp1', 'aesthetics', 'nutrition', 'fitness', 'skincare'],
  subscriptionRequired: false, // clinic covers cost during beta
  treatmentBookingUrl: 'https://aestheticrecord.com',
};

export const KENOVUS_CONFIG: BrandConfig = {
  appName: 'Kenovus',
  clinicName: 'Kenovus',
  aiCoachName: 'Keva',
  primaryColor: '#2A5C8A',
  accentColor: '#4A90D9',
  logoKey: 'kenovus',
  tagline: 'Your longevity coach.',
  focusAreas: ['nutrition', 'fitness', 'longevity'],
  subscriptionRequired: true,
  treatmentBookingUrl: null,
};

/** Returns the correct brand config based on the user's clinic_id */
export function getBrandConfig(clinicId: string | null | undefined): BrandConfig {
  // Null clinic_id → consumer Kenovus experience
  if (!clinicId) return KENOVUS_CONFIG;
  // Any clinic_id → SonaLife clinic experience (could be clinic-specific in future)
  return SONA_CONFIG;
}

/** Get the AI coach system prompt persona for the brand */
export function getBrandSystemPromptAddendum(config: BrandConfig): string {
  if (config.logoKey === 'kenovus') {
    return `
You are Keva, the AI wellness coach for Kenovus — a longevity-focused wellness platform.
Focus areas: nutrition optimization, strength training, metabolic health, sleep, and longevity protocols.
You do NOT reference Sona Medical Aesthetics, aesthetic treatments, or GLP-1 medications.
You DO coach on: general nutrition, fitness, supplements, sleep optimization, and science-backed wellness.
Tone: evidence-based, empowering, science-forward.
`;
  }
  return ''; // Sona config handled by main system prompt
}
