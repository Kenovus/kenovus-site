import type { UserProfile } from '@/types/user';

/** Appends persona-aware coaching instructions (tone + nutrition emphasis). */
export function buildPersonaCoachContextBlock(profile: UserProfile | null): string {
  if (!profile) return '';

  const lines: string[] = [];

  const isClinic = profile.role === 'clinic_patient' || profile.primary_persona === 'clinic_patient';
  if (isClinic) {
    lines.push(
      'Persona: clinic-connected patient. Tone: concise, clinical-adjacent, provider-aligned. Reference their care team when appropriate; do not replace clinician decisions.',
    );
  } else if (profile.primary_persona === 'performance' || profile.wellness_track === 'fitness_recomp') {
    lines.push(
      'Persona: performance / recomposition focus. Tone: data-driven, periodization-aware; still no medical dosing or diagnosis.',
    );
  } else {
    lines.push(
      'Persona: general consumer. Tone: balanced, educational, supportive; practical habits over jargon.',
    );
  }

  const age = profile.age_range ?? null;
  const activity = profile.activity_level_persona ?? null;
  const geriatricOrRecovery =
    age === '65+' ||
    activity === 'limited_mobility' ||
    activity === 'recovering_surgery' ||
    profile.primary_persona === 'geriatric_recovery';

  if (geriatricOrRecovery) {
    lines.push(`
Geriatric / limited mobility / post-surgical coaching overlay:
- Protein: emphasize roughly 1.2–1.5 g/kg body weight when weight is known (sarcopenia prevention framing); if weight unknown, coach protein-forward meals without implying a prescription.
- Key nutrients to mention when relevant (educational, not dosing): vitamin D, calcium, collagen peptides, omega-3, zinc, B12, magnesium — tie each to bone, immunity, wound healing, sleep, or cognition as appropriate.
- Post-surgical: higher protein for repair; smaller, more frequent meals (4–6/day) if appetite is low; softer textures if chewing is hard; strong hydration emphasis (dehydration can mimic confusion).
- Supplements / anticoagulants: if the user mentions blood thinners or anticoagulants, warn to avoid starting high-dose blood-thinning supplements (e.g. high-dose fish oil, garlic, ginkgo) without clinician approval — never tell them to stop prescribed meds.
- Activity: gradual return; walking is an excellent starting point.
- Tone: warmer, more patient, more explanatory; avoid bodybuilding or performance hype. Frame as "supporting your recovery" and "staying strong and independent." Prefer "check with your doctor" when uncertain. Never suggest stopping medications.`,
    );
  }

  if (profile.persona_goal) {
    lines.push(`Self-reported primary goal (persona): ${profile.persona_goal}. Align examples and pacing to this goal without being clinical.`);
  }

  return lines.join('\n\n').trim();
}
