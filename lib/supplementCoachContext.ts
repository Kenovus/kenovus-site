import { canUseGlp1PatientFeatures } from '@/lib/consumerTier';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { curatedLabelForPresetKey } from '@/lib/supplements/curatedPresets';
import { getSupplementEvidenceByLabel } from '@/lib/supplementIntelligence';
import {
  fetchAdherenceSummary,
  fetchLastTakenDate,
  fetchPatientSupplements,
} from '@/lib/patientSupplements';
import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/user';

const WEEKLY_LABEL: Record<string, string> = {
  every_day: 'Every day',
  most_days: 'Most days',
  hit_or_miss: 'Hit or miss',
  barely: 'Barely',
};

function daysSince(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const a = new Date(`${isoDate}T12:00:00`);
  const b = new Date();
  b.setHours(12, 0, 0, 0);
  return Math.floor((b.getTime() - a.getTime()) / (86400 * 1000));
}

/** Appended to every My Coach turn so the model can connect symptoms ↔ supplement adherence. */
export async function buildSupplementCoachContextBlock(
  authUserId: string,
  profile: UserProfile | null,
): Promise<string> {
  const patientId = await fetchPatientIdForAuthUser(authUserId);
  if (!patientId) return '';

  const { data: weeklyRow } = await supabase
    .from('patient_supplement_weekly_checkins')
    .select('week_anchor, consistency')
    .eq('patient_id', patientId)
    .order('week_anchor', { ascending: false })
    .limit(1)
    .maybeSingle();

  const weeklyLine =
    weeklyRow?.week_anchor && weeklyRow?.consistency
      ? `Latest weekly supplement check-in (week of ${weeklyRow.week_anchor}): ${WEEKLY_LABEL[String(weeklyRow.consistency)] ?? weeklyRow.consistency}.`
      : '';

  const rows = await fetchPatientSupplements(patientId);
  const active = rows.filter((r) => r.is_active);
  if (active.length === 0) {
    return weeklyLine
      ? `Supplements: patient has no active supplements in their tracker right now. ${weeklyLine}`
      : 'Supplements: patient has no active supplements in their tracker right now.';
  }

  const ids = active.map((r) => r.id);
  const adherence = await fetchAdherenceSummary(patientId, ids, 14);
  const lines: string[] = [];
  lines.push('Active supplement stack (from SonaLife tracker):');
  for (const r of active) {
    const name =
      r.supplement_name?.trim() ||
      (r.preset_key ? curatedLabelForPresetKey(r.preset_key) : (r.custom_name ?? 'Custom'));
    const dose = r.dose?.trim() || 'dose not set';
    const freq = r.frequency?.trim() || 'frequency not set';
    const ad = adherence[r.id] ?? { takenDays: 0, loggedDays: 0 };
    const ev = getSupplementEvidenceByLabel(name);
    lines.push(
      `- ${name}: ${dose}; ${freq}. Last ~14 days: marked “taken” on ${ad.takenDays} day(s); had a log entry on ${ad.loggedDays} day(s).${ev ? ` Evidence rating: ${ev.evidence}.` : ''}`,
    );
    if (r.preset_key === 'creatine_monohydrate') {
      const last = await fetchLastTakenDate(patientId, r.id);
      const gap = daysSince(last);
      if (gap === null) lines.push(`  (Creatine: no “taken” logs yet.)`);
      else lines.push(`  (Creatine: last marked taken ${last}, ~${gap} day(s) ago.)`);
    }
  }

  const glp1 = profile ? canUseGlp1PatientFeatures(profile) : false;
  if (glp1) {
    lines.push(
      'Program note: patient is on GLP-1–related Sona support — prioritize practical creatine consistency and protein adequacy for muscle preservation when relevant; stay within coaching (no dosing).',
    );
  }

  if (weeklyLine) {
    lines.push(weeklyLine);
  }

  lines.push(
    'Coaching rule: when symptoms overlap supplement gaps (e.g. muscle soreness + creatine not logged for several days), you may connect those dots briefly and suggest checking consistency — never diagnose.',
  );
  lines.push(
    'Disclaimer to weave in when suggesting any new supplement: “Check with Simi before adding new supplements, especially if you’re on medications.”',
  );
  lines.push(
    'When members ask for supplement evidence, summarize plainly (e.g. “Studies suggest creatine can help preserve muscle during GLP-1 care”), avoid overclaiming, and keep provider disclaimer language.',
  );

  return lines.join('\n');
}
