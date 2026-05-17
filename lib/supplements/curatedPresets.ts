/** Stable keys stored in `patient_supplements.preset_key` (curated catalog). */
export const CURATED_SUPPLEMENT_PRESETS = [
  { key: 'creatine_monohydrate', label: 'Creatine Monohydrate' },
  { key: 'multivitamin', label: 'Multivitamin' },
  { key: 'vitamin_d3', label: 'Vitamin D3' },
  { key: 'magnesium_glycinate', label: 'Magnesium Glycinate' },
  { key: 'b12', label: 'B12' },
  { key: 'omega3_fish_oil', label: 'Omega-3 / Fish Oil' },
  { key: 'electrolytes', label: 'Electrolytes' },
  { key: 'hmb', label: 'HMB' },
  { key: 'tmg', label: 'TMG' },
  { key: 'berberine', label: 'Berberine' },
  { key: 'collagen_peptides', label: 'Collagen Peptides' },
  { key: 'coq10', label: 'CoQ10' },
  { key: 'probiotic', label: 'Probiotic' },
  { key: 'digestive_enzymes', label: 'Digestive Enzymes' },
  { key: 'fiber', label: 'Fiber supplement' },
] as const;

export type CuratedSupplementKey = (typeof CURATED_SUPPLEMENT_PRESETS)[number]['key'];

export const WEEKLY_SUPPLEMENT_CHOICES = [
  { id: 'every_day' as const, label: 'Every day' },
  { id: 'most_days' as const, label: 'Most days' },
  { id: 'hit_or_miss' as const, label: 'Hit or miss' },
  { id: 'barely' as const, label: 'Barely' },
];

export type WeeklySupplementConsistency = (typeof WEEKLY_SUPPLEMENT_CHOICES)[number]['id'];

export function curatedLabelForPresetKey(key: string): string {
  const row = CURATED_SUPPLEMENT_PRESETS.find((p) => p.key === key);
  return row?.label ?? key;
}
