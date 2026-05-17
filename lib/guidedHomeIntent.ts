import type { Href } from 'expo-router';

/** Default booking surface (replace with clinic-specific link if needed). */
export const SONALIFE_BOOKING_URL = 'https://www.aestheticrecord.com/';

export type GuidedHomeAction =
  | { type: 'push'; href: Href }
  | { type: 'coach'; prefill: string }
  | { type: 'coachBlank' }
  | { type: 'openUrl'; url: string }
  | { type: 'scrollChecklist' };

/** Internal chip query: open My Coach with no prefill (user types freely). */
export const GUIDED_HOME_COACH_BLANK_QUERY = '__sonalife_coach_blank__';

/**
 * Lightweight keyword routing for the guided home command center.
 * Unclear phrasing falls through to My Coach with the original text prefilled.
 */
export function resolveGuidedHomeIntent(raw: string): GuidedHomeAction {
  if (raw === GUIDED_HOME_COACH_BLANK_QUERY) {
    return { type: 'coachBlank' };
  }
  const s = raw.toLowerCase().trim();
  if (!s) return { type: 'coach', prefill: '' };

  if (/\b(book|booking|appointment|schedule|visit|aesthetic)\b/.test(s)) {
    return { type: 'openUrl', url: SONALIFE_BOOKING_URL };
  }
  if (/\b(supplement|supplements|vitamins?|pills?|creatine)\b/.test(s)) {
    return { type: 'push', href: '/patient/profile/supplements' };
  }
  if (/\b(checklist|check-in|check in|streak|daily checklist|my checklist)\b/.test(s)) {
    return { type: 'scrollChecklist' };
  }
  if (/\b(progress|inbody|labs?|lab results|body fat|photos?)\b/.test(s)) {
    return { type: 'push', href: '/patient/progress' };
  }
  if (/\b(weight|weigh in|scale|log weight)\b/.test(s)) {
    return { type: 'push', href: '/patient/progress/weight' };
  }
  if (
    /\b(macro|macros|nutrition|meal|meals|food|calories?|kcal|lunch|dinner|breakfast|protein|carbs?|fat|log my)\b/.test(s)
  ) {
    return { type: 'push', href: '/patient/nutrition' };
  }
  if (/\b(coach|talk|chat|help|how am i|how'm i|feeling|advice)\b/.test(s)) {
    return { type: 'coach', prefill: raw };
  }
  return { type: 'coach', prefill: raw };
}

export type TimeBand = 'morning' | 'afternoon' | 'evening';

export function getTimeBand(d = new Date()): TimeBand {
  const h = d.getHours();
  // Local device time: morning 5–11, afternoon 11–17, evening 17–22; late night maps to evening chips
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'afternoon';
  return 'evening';
}

export type SuggestionChip = { label: string; query: string };

export function suggestionChipsForBand(band: TimeBand): SuggestionChip[] {
  switch (band) {
    case 'morning':
      return [
        { label: 'Log my weight', query: 'Log my weight' },
        { label: 'Start my check-in', query: 'Start my check-in' },
        { label: 'See my macros', query: 'See my macros' },
        { label: 'Something else', query: GUIDED_HOME_COACH_BLANK_QUERY },
      ];
    case 'afternoon':
      return [
        { label: 'Log my lunch', query: 'Log my lunch' },
        { label: 'How am I doing today?', query: 'How am I doing today?' },
        { label: 'Log supplements', query: 'Log supplements' },
        { label: 'See my macros', query: 'See my macros' },
        { label: 'Something else', query: GUIDED_HOME_COACH_BLANK_QUERY },
      ];
    case 'evening':
    default:
      return [
        { label: 'Log dinner', query: 'Log dinner' },
        { label: 'End of day check-in', query: 'End of day check-in' },
        { label: 'Review my day', query: 'Review my day' },
        { label: 'Log supplements', query: 'Log supplements' },
        { label: 'Something else', query: GUIDED_HOME_COACH_BLANK_QUERY },
      ];
  }
}
