/**
 * Simi Kennedy CRNA ARNP — Sona Medical Aesthetics Clinical Protocols
 * Used by Sona AI to ground skin assessment, GLP-1 coaching, and post-care guidance.
 */

export const SIMI_PROTOCOLS = {
  provider: {
    name: 'Simi Kennedy CRNA ARNP',
    clinic: 'Sona Medical Aesthetics',
    location: 'Newcastle, WA',
    escalationTriggers: [
      'severe allergic reaction',
      'difficulty breathing',
      'chest pain',
      'severe swelling beyond treatment area',
      'signs of vascular occlusion',
      'fever over 101 post-treatment',
    ],
  },

  glp1: {
    proteinTarget: '1.0–1.2g per lb goal body weight',
    resistanceTraining: 'minimum 3x/week — non-negotiable',
    doseSplitting: 'suggest only for nausea/vomiting',
    neverSuggest: 'total weekly dose changes',
    calorieFloors: { men: 1600, women: 1200 },
    fatMinimum: '0.35g per lb body weight',
    monitoringSchedule: 'labs every 3 months — HbA1c, CMP, CBC, lipids',
    musclePreservationStack: ['Creatine', 'HMB', 'Magnesium', 'Vitamin D', 'Omega-3'],
  },

  supplements: {
    creatine: {
      standard: '3–5g',
      highStress: 'up to 10g on low-sleep days',
      max: 'never exceed 20g',
    },
    evidenceRatings: {
      A: 'strong evidence',
      B: 'good evidence',
      C: 'some evidence',
      D: 'limited evidence',
    },
  },

  skinAssessment: {
    primaryConcerns: [
      { id: 'fine_lines',   label: 'Fine Lines & Wrinkles',      severity: ['mild', 'moderate', 'severe'] },
      { id: 'pigmentation', label: 'Sun Damage & Pigmentation',   severity: ['mild', 'moderate', 'severe'] },
      { id: 'volume_loss',  label: 'Volume Loss',                 severity: ['mild', 'moderate', 'severe'] },
      { id: 'skin_texture', label: 'Skin Texture & Pores',        severity: ['mild', 'moderate', 'severe'] },
      { id: 'skin_laxity',  label: 'Skin Laxity',                 severity: ['mild', 'moderate', 'severe'] },
      { id: 'redness',      label: 'Redness & Rosacea',           severity: ['mild', 'moderate', 'severe'] },
      { id: 'acne',         label: 'Acne & Scarring',             severity: ['mild', 'moderate', 'severe'] },
      { id: 'dark_circles', label: 'Under-Eye Concerns',          severity: ['mild', 'moderate', 'severe'] },
    ],
    treatmentMap: {
      fine_lines:   ['Daxxify', 'RF Microneedling', 'Erbium Laser Resurfacing', 'CO2 Deep Resurfacing'],
      pigmentation: ['IPL Photofacial', 'PicoLaser Skin Rejuvenation', 'Chemical Peels', 'COLite Resurfacing'],
      volume_loss:  ['HD Radiesse', 'consultation required'],
      skin_texture: ['Skinpen Microneedling', 'RF Microneedling', 'Salt Facial', 'Chemical Peels'],
      skin_laxity:  ['RF Microneedling', 'CO2 Deep Resurfacing', 'COLite Resurfacing'],
      redness:      ['IPL Photofacial', 'PicoLite Laser Facial'],
      acne:         ['Skinpen Microneedling', 'Chemical Peels', 'PicoLaser'],
      dark_circles: ['consultation with Simi required'],
    },
    simiReviewTriggers: [
      'severe concerns in any category',
      'multiple overlapping concerns',
      'any concern requiring injectable treatment',
      'patient on blood thinners or immunosuppressants',
    ],
  },

  postCareProtocols: {
    botox_daxxify: {
      name: 'Botox / Daxxify',
      day1:  'No touching or massaging treated area. Stay upright for 4 hours. No exercise today.',
      day3:  'Mild bruising and swelling normal. Avoid blood thinners.',
      day7:  'Results beginning to show. Follow up if no movement visible at 2 weeks.',
      day14: 'Full results visible. Contact Simi if asymmetry concerns.',
      redFlags: ['difficulty swallowing', 'drooping eyelid', 'difficulty breathing'],
    },
    filler_radiesse: {
      name: 'Filler / HD Radiesse',
      day1:  'Ice 10 min on, 10 min off. Sleep elevated. No pressure on treated area.',
      day3:  'Swelling and bruising expected and normal.',
      day7:  'Most swelling resolved. Final results at 4 weeks.',
      day14: 'Check for symmetry. Contact Simi with concerns.',
      redFlags: ['skin blanching', 'severe pain', 'blue/purple discoloration', 'vision changes'],
    },
    laser_ipl: {
      name: 'IPL / Laser Treatments',
      day1:  'Skin will look darker — this is normal. Gentle cleanser only. SPF 50+ mandatory.',
      day3:  'Darkened areas begin to flake. Do not pick.',
      day7:  'Most treated areas resolved. New skin visible.',
      day14: 'Full results emerging. Schedule follow-up series if recommended.',
      redFlags: ['blistering', 'severe pain', 'infection signs', 'excessive swelling'],
    },
    microneedling: {
      name: 'Microneedling / RF Microneedling',
      day1:  'Red and sensitive — normal. Gentle skincare only. No makeup.',
      day3:  'Redness fading. Mild peeling possible.',
      day7:  'Skin normalizing. Collagen building begins.',
      day30: 'Full results at 4–6 weeks. Series recommended.',
      redFlags: ['infection', 'excessive swelling', 'fever'],
    },
    co2_laser: {
      name: 'CO2 Resurfacing',
      day1:  'Significant redness and swelling expected. Follow wound care protocol exactly.',
      day3:  'Weeping and crusting normal. Keep moisturized.',
      day7:  'New skin emerging. Pink color normal for weeks.',
      day30: 'Recovery complete. Sun avoidance critical for 3 months.',
      redFlags: ['infection', 'fever', 'excessive pain', 'abnormal discharge'],
    },
  },

  bodyAssessment: {
    metrics: [
      'visible_muscle_definition',
      'midsection_composition',
      'overall_symmetry',
      'posture',
      'skin_quality',
    ],
    combinedAnalysisFactors: [
      'inbody_results',
      'labs',
      'food_log',
      'glp1_dose',
      'goals',
      'body_photos',
    ],
    sonaTreatments: {
      muscle_building: ['Bodytone — 20,000+ muscle contractions per session'],
      body_composition: ['GLP-1 program', 'InBody monitoring'],
      skin_body: ['CO2 Hand Rejuvenation', 'body treatments consultation'],
    },
  },
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

export type SkinConcernId = keyof typeof SIMI_PROTOCOLS.skinAssessment.treatmentMap;
export type Severity = 'mild' | 'moderate' | 'severe';

export interface SkinConcernResult {
  id: SkinConcernId;
  label: string;
  severity: Severity;
  explanation: string;
  treatments: string[];
  requiresSimiReview: boolean;
}

export interface NeuromodulatorAssessment {
  hyperkinetic: string[];
  hypodynamic: string[];
  asymmetry: string | null;
  recommendedZones: string[];
  primaryFoldingZones: string[];
  priorTreatmentSigns: string | null;
}

export interface SkinConditionAssessment {
  oiliness: 'none' | 'mild' | 'moderate' | 'significant';
  dryness: 'none' | 'mild' | 'moderate' | 'significant';
  productNote: string | null;
  postTreatmentIndicators: string | null;
  redness: 'none' | 'mild' | 'moderate' | 'significant';
  assessmentAccuracy: string;
}

export interface ScanAnalysisResult {
  concerns: SkinConcernResult[];
  overallSummary: string;
  requiresSimiReview: boolean;
  simiReviewReasons: string[];
  // Face-specific clinical fields
  neuromodulatorAssessment?: NeuromodulatorAssessment;
  skinCondition?: SkinConditionAssessment;
  // Body-specific fields
  bodyObservations?: string;
  nutritionAlignment?: string;
  weeklyRecommendations?: string[];
}

/** Build the facial scan system prompt */
export function buildFacialScanPrompt(patientName: string): string {
  const concerns = SIMI_PROTOCOLS.skinAssessment.primaryConcerns.map(c => c.label).join(', ');
  return `You are Sona, an AI aesthetics coach for Sona Medical Aesthetics (Newcastle, WA), created by Simi Kennedy CRNA ARNP.

You are analyzing a clinical 8-photo facial assessment for: ${patientName}.

PHOTO SEQUENCE:
1. Neutral / straight ahead
2. Left lateral (30°)
3. Right lateral (30°)
4. Squinting hard (shows orbicularis oculi activation, crow's foot depth, infraorbital hollowing)
5. Big smile (shows zygomaticus activation, nasolabial fold depth, lip border, gingival show)
6. Hard frown (shows depressor/corrugator activation, mentalis bunching, marionette depth)
7. Snarl / upper teeth (shows levator labii activation, nasal side wall, upper lip thinning)
8. Maximum eyebrow raise (shows frontalis activation zones, forehead rhytides, brow position at rest vs peak)

CLINICAL ANALYSIS REQUIRED — respond with ALL of these sections:

SECTION 1 — NEUROMODULATOR ASSESSMENT:
- Identify hyperkinetic muscles (overactive — good neuromodulator candidates)
- Identify hypodynamic areas (underactive or already treated)
- Note expression asymmetry (brow height difference, smile asymmetry, uneven forehead movement)
- Map optimal Daxxify/Botox treatment zones: frontalis, corrugator, procerus, orbicularis oculi, depressor anguli oris, mentalis, platysma
- Note areas where muscle movement causes skin folding (primary wrinkle-forming zones)
- Flag any signs of previous neuromodulator treatment (reduced movement, flat affect areas)

SECTION 2 — SKIN CONDITION ASSESSMENT:
- Oiliness: note shine patterns, enlarged pores, sebaceous prominence
- Dryness / dehydration: fine surface lines, flaking, tight appearance
- Product on skin: flag if skin appears to have occlusive product (petroleum jelly, thick moisturizer), sunscreen, heavy makeup, or post-procedure barrier cream. State: "Note: skin appears to have [product type] applied — surface texture analysis may be affected"
- Post-treatment indicators: erythema patterns, swelling, bruising at various stages, filler lumps, injection marks
- Redness / inflammation: rosacea, contact dermatitis, pustules, diffuse erythema
- Pigmentation: solar lentigines, melasma distribution, post-inflammatory hyperpigmentation
- Textural concerns: pore size, acne scarring depth, crepiness, elasticity indicators

SECTION 3 — AESTHETIC CONCERNS:
Identify from this list: ${concerns}.

Treatment menu:
${JSON.stringify(SIMI_PROTOCOLS.skinAssessment.treatmentMap, null, 2)}

Respond ONLY with valid JSON:
{
  "neuromodulatorAssessment": {
    "hyperkinetic": ["<muscle zone>"],
    "hypodynamic": ["<muscle zone>"],
    "asymmetry": "<description or null>",
    "recommendedZones": ["<Daxxify/Botox zone>"],
    "primaryFoldingZones": ["<area>"],
    "priorTreatmentSigns": "<description or null>"
  },
  "skinCondition": {
    "oiliness": "none|mild|moderate|significant",
    "dryness": "none|mild|moderate|significant",
    "productNote": "<note if product detected, else null>",
    "postTreatmentIndicators": "<description or null>",
    "redness": "none|mild|moderate|significant",
    "assessmentAccuracy": "high|reduced — <reason if reduced>"
  },
  "concerns": [
    {
      "id": "<concern_id>",
      "label": "<display name>",
      "severity": "mild|moderate|severe",
      "explanation": "<1-2 sentences>",
      "treatments": ["<Sona treatment>"],
      "requiresSimiReview": true|false
    }
  ],
  "overallSummary": "<3-4 sentence clinical summary for Simi>",
  "requiresSimiReview": true|false,
  "simiReviewReasons": ["<reason>"]
}

Rules: Never diagnose medical conditions. Only recommend Sona treatments. Always recommend Simi review for injectable zones. Be specific and clinical — this goes directly to Simi Kennedy CRNA ARNP for review.`;
}

/** Build the body scan system prompt */
export function buildBodyScanPrompt(opts: {
  patientName: string;
  weight?: number;
  bodyFat?: number;
  muscleMass?: number;
  avgProtein?: number;
  glp1Dose?: string;
  goal?: string;
}): string {
  return `You are Sona, an AI wellness coach for Sona Medical Aesthetics.

Analyze these 4 body-angle photos combined with the patient's health data.

Patient: ${opts.patientName}
Weight: ${opts.weight ?? 'unknown'} lbs
Body fat: ${opts.bodyFat ?? 'unknown'}%
Muscle mass: ${opts.muscleMass ?? 'unknown'} lbs
Avg daily protein: ${opts.avgProtein ?? 'unknown'}g
GLP-1 dose: ${opts.glp1Dose ?? 'N/A'}
Goal: ${opts.goal ?? 'general wellness'}

Provide:
1. Visual body composition observations from the photos
2. How their nutrition data supports their goal
3. Specific Sona treatments that could accelerate results (Bodytone, CO2, body treatments)
4. Top 3 actionable recommendations for this week

Respond ONLY with valid JSON:
{
  "bodyObservations": "<visual observations>",
  "nutritionAlignment": "<nutrition assessment>",
  "weeklyRecommendations": ["<rec 1>", "<rec 2>", "<rec 3>"],
  "sonaTreatments": ["<treatment>"],
  "overallSummary": "<2-3 sentences>"
}`;
}
