import { anthropicMessages } from '@/lib/anthropic';
import type { WeeklySupplementConsistency } from '@/lib/supplements/curatedPresets';

const SYSTEM = `You are the SonaLife wellness coach. The patient answered a weekly supplement consistency check-in (not clinical).
Give 2–3 short sentences: warm, confident, specific to their answer. No bullet lists. No new supplement recommendations without reminding them to check with Simi Kennedy CRNA ARNP before adding anything new, especially on medications. No dosing.`;

const CHOICE_LABEL: Record<WeeklySupplementConsistency, string> = {
  every_day: 'Every day',
  most_days: 'Most days',
  hit_or_miss: 'Hit or miss',
  barely: 'Barely',
};

export async function fetchWeeklySupplementCoachReply(params: {
  firstName: string;
  choice: WeeklySupplementConsistency;
}): Promise<string> {
  const label = CHOICE_LABEL[params.choice];
  const { text, error } = await anthropicMessages({
    system: SYSTEM,
    user: `First name: ${params.firstName.trim() || 'friend'}.\nWeekly question: How consistent were you with your supplements this week?\nThey chose: "${label}".`,
    maxTokens: 200,
  });
  if (error) {
    console.warn('[supplementWeeklyCoachReply]', error.message);
  }
  if (text?.trim()) return text.trim();
  if (params.choice === 'every_day' || params.choice === 'most_days') {
    return `${params.firstName.trim() || 'You'}—that consistency is real leverage. Keep stacking small wins; if anything slips next week, pick one anchor habit and protect it.`;
  }
  if (params.choice === 'hit_or_miss') {
    return `Thanks for the honest read—most people land here sometimes. Next week, try pairing each supplement with something you already do daily so it sticks without drama.`;
  }
  return `Rough weeks happen. No shame—what matters is the next right step. Pick one supplement that matters most to you this week and make it stupid-easy to hit; check with Simi before changing anything clinical.`;
}
