import { supabase } from '@/lib/supabase';

export type EvidenceGrade = 'A' | 'B' | 'C' | 'D';
export type SupplementTrack =
  | 'glp1'
  | 'hrt'
  | 'longevity'
  | 'body_composition'
  | 'aesthetics';

export type SupplementEvidenceItem = {
  key: string;
  name: string;
  evidence: EvidenceGrade;
  primaryIndications: string[];
  relevantFor: SupplementTrack[];
  dosingRange: string;
  cycling: string;
  interactions: string[];
  notes: string;
};

export const SUPPLEMENT_EVIDENCE_DB: SupplementEvidenceItem[] = [
  {
    key: 'creatine_monohydrate',
    name: 'Creatine Monohydrate',
    evidence: 'A',
    primaryIndications: ['Muscle preservation', 'Strength', 'Power output'],
    relevantFor: ['glp1', 'body_composition', 'longevity'],
    dosingRange: '3-5 g daily',
    cycling: 'No cycling required for most patients',
    interactions: ['Use caution with renal disease history', 'Hydration status should be monitored'],
    notes: 'Most robust RCT-backed supplement for lean-mass preservation during calorie deficits.',
  },
  {
    key: 'vitamin_d3',
    name: 'Vitamin D3',
    evidence: 'A',
    primaryIndications: ['Low 25(OH)D', 'Bone health', 'Immune support'],
    relevantFor: ['glp1', 'hrt', 'longevity', 'aesthetics'],
    dosingRange: '1,000-4,000 IU daily; lab-guided',
    cycling: 'No cycling; titrate to lab targets',
    interactions: ['Monitor with thiazides', 'Hypercalcemia risk at high chronic doses'],
    notes: 'Prefer lab-guided correction and maintenance rather than fixed universal dosing.',
  },
  {
    key: 'magnesium_glycinate',
    name: 'Magnesium (glycinate)',
    evidence: 'B',
    primaryIndications: ['Sleep quality', 'Cramping', 'Constipation support'],
    relevantFor: ['glp1', 'hrt', 'longevity', 'body_composition'],
    dosingRange: '200-400 mg elemental magnesium/day',
    cycling: 'No cycling required',
    interactions: ['Separate from tetracyclines/quinolones', 'Use caution in advanced CKD'],
    notes: 'Generally well-tolerated form for evening use and GI-sensitive patients.',
  },
  {
    key: 'b12',
    name: 'Vitamin B12',
    evidence: 'A',
    primaryIndications: ['Deficiency correction', 'Metformin-associated depletion risk'],
    relevantFor: ['glp1', 'longevity', 'body_composition'],
    dosingRange: '500-2,000 mcg oral daily (or per lab protocol)',
    cycling: 'No cycling; lab-guided maintenance',
    interactions: ['Absorption affected by gastric acid suppression in some patients'],
    notes: 'Best used with deficiency context or high-risk patterns.',
  },
  {
    key: 'omega3_fish_oil',
    name: 'Omega-3 (EPA/DHA)',
    evidence: 'B',
    primaryIndications: ['Cardiometabolic support', 'Triglycerides', 'Recovery'],
    relevantFor: ['hrt', 'longevity', 'body_composition', 'aesthetics'],
    dosingRange: '1-3 g combined EPA+DHA daily',
    cycling: 'No cycling required',
    interactions: ['Bleeding-risk meds (monitor)', 'GI tolerance varies'],
    notes: 'Dose by combined EPA/DHA content, not capsule count.',
  },
  {
    key: 'hmb',
    name: 'HMB',
    evidence: 'B',
    primaryIndications: ['Muscle preservation in catabolic phases', 'Deconditioning risk'],
    relevantFor: ['glp1', 'body_composition'],
    dosingRange: '3 g daily, split doses',
    cycling: 'Typically used during deficit/high-risk periods',
    interactions: ['No major common medication conflicts established'],
    notes: 'Most useful when appetite is suppressed and resistance training quality is variable.',
  },
  {
    key: 'tmg',
    name: 'TMG (Betaine)',
    evidence: 'C',
    primaryIndications: ['Methylation support', 'Homocysteine support'],
    relevantFor: ['longevity', 'body_composition'],
    dosingRange: '500-2,500 mg daily',
    cycling: 'Optional periodic reassessment',
    interactions: ['Consider methylation context / lab interpretation'],
    notes: 'Evidence is promising but less mature than creatine or vitamin D.',
  },
  {
    key: 'berberine',
    name: 'Berberine',
    evidence: 'B',
    primaryIndications: ['Glycemic support', 'Insulin resistance patterns'],
    relevantFor: ['glp1', 'longevity', 'body_composition'],
    dosingRange: '500 mg 1-3x/day with meals',
    cycling: 'Can be used in blocks with GI tolerance reassessment',
    interactions: ['Potential additive glucose lowering with meds', 'GI side effects common'],
    notes: 'Use carefully alongside antidiabetic medications and monitor symptoms.',
  },
  {
    key: 'coq10',
    name: 'CoQ10',
    evidence: 'B',
    primaryIndications: ['Mitochondrial support', 'Fatigue support', 'Statin-associated symptoms'],
    relevantFor: ['hrt', 'longevity', 'aesthetics'],
    dosingRange: '100-300 mg daily',
    cycling: 'No required cycling',
    interactions: ['Potential interaction with warfarin monitoring context'],
    notes: 'Adjunctive option in fatigue-focused wellness plans.',
  },
];

export type StackTemplateId =
  | 'glp1_muscle_preservation'
  | 'hrt_support'
  | 'longevity'
  | 'body_recomp';

export type SupplementStackTemplate = {
  id: StackTemplateId;
  label: string;
  goal: string;
  items: Array<{ key: string; why: string }>;
};

export const STACK_TEMPLATES: SupplementStackTemplate[] = [
  {
    id: 'glp1_muscle_preservation',
    label: 'GLP-1 Muscle Preservation',
    goal: 'Preserve lean mass during appetite suppression / deficit',
    items: [
      { key: 'creatine_monohydrate', why: 'Best-supported lean-mass preservation adjunct' },
      { key: 'hmb', why: 'Added anti-catabolic support in higher-risk periods' },
      { key: 'magnesium_glycinate', why: 'Recovery/sleep support for training adherence' },
      { key: 'vitamin_d3', why: 'Deficiency correction and foundational health support' },
    ],
  },
  {
    id: 'hrt_support',
    label: 'HRT Support',
    goal: 'Support cardiometabolic and recovery foundations',
    items: [
      { key: 'vitamin_d3', why: 'Common deficiency and bone-health relevance' },
      { key: 'omega3_fish_oil', why: 'Cardiometabolic support' },
      { key: 'magnesium_glycinate', why: 'Sleep/recovery support' },
      { key: 'coq10', why: 'Energy/fatigue adjunct for selected patients' },
    ],
  },
  {
    id: 'longevity',
    label: 'Longevity Foundation',
    goal: 'Evidence-aware healthy aging support',
    items: [
      { key: 'omega3_fish_oil', why: 'Cardiometabolic support' },
      { key: 'vitamin_d3', why: 'Foundational deficiency correction' },
      { key: 'magnesium_glycinate', why: 'Sleep/recovery and metabolic support' },
      { key: 'coq10', why: 'Mitochondrial support (select patients)' },
      { key: 'tmg', why: 'Emerging methylation/homocysteine support' },
    ],
  },
  {
    id: 'body_recomp',
    label: 'Body Recomp',
    goal: 'Strength retention plus body composition support',
    items: [
      { key: 'creatine_monohydrate', why: 'Performance and lean-mass support' },
      { key: 'hmb', why: 'Helpful in aggressive deficit phases' },
      { key: 'b12', why: 'Correct deficiency risk and support energy' },
      { key: 'magnesium_glycinate', why: 'Recovery support' },
    ],
  },
];

export function getSupplementEvidenceByKey(key: string): SupplementEvidenceItem | null {
  return SUPPLEMENT_EVIDENCE_DB.find((x) => x.key === key) ?? null;
}

export function getSupplementEvidenceByLabel(label: string): SupplementEvidenceItem | null {
  const l = label.trim().toLowerCase();
  return (
    SUPPLEMENT_EVIDENCE_DB.find(
      (x) => x.name.toLowerCase() === l || x.key.toLowerCase() === l || l.includes(x.name.toLowerCase()),
    ) ?? null
  );
}

export function buildStack(id: StackTemplateId): {
  template: SupplementStackTemplate;
  supplements: Array<SupplementEvidenceItem & { why: string }>;
} | null {
  const template = STACK_TEMPLATES.find((x) => x.id === id);
  if (!template) return null;
  const supplements = template.items
    .map((i) => {
      const ev = getSupplementEvidenceByKey(i.key);
      return ev ? { ...ev, why: i.why } : null;
    })
    .filter((x): x is SupplementEvidenceItem & { why: string } => x != null);
  return { template, supplements };
}

export async function cacheSupplementEvidence(
  supplementKey: string,
  evidenceJson: Record<string, unknown>,
): Promise<void> {
  await supabase.from('supplement_evidence_cache').upsert(
    {
      supplement_key: supplementKey,
      evidence_json: evidenceJson,
      refreshed_at: new Date().toISOString(),
    },
    { onConflict: 'supplement_key' },
  );
}
