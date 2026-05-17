import {
  COACHING_FREQUENCY_LABELS,
  EXPERIENCE_LEVEL_LABELS,
  HAS_TARGET_LABELS,
  PRIMARY_GOAL_LABELS,
  daysUntilTargetDate,
  fetchPatientGoalsForAuthUser,
  type PatientGoalsRow,
} from '@/lib/patientGoals';
import { formatPhaseHomeLine, TRAINING_PHASE_LABELS, weeksOutFromTargetDate } from '@/lib/phaseDisplay';

function formatTargets(row: PatientGoalsRow): string {
  const parts: string[] = [];
  if (row.target_weight != null) parts.push(`target weight ${row.target_weight} lb (or as logged)`);
  if (row.target_body_fat_pct != null) parts.push(`target body fat ~${row.target_body_fat_pct}%`);
  if (row.target_date) parts.push(`target date ${row.target_date}`);
  return parts.length ? parts.join('; ') : 'no numeric targets on file';
}

/** Factual block appended to My Coach user turns (never diagnose; coaching tone only). */
export async function buildPatientGoalsCoachContextBlock(authUserId: string): Promise<string> {
  const row = await fetchPatientGoalsForAuthUser(authUserId);
  if (!row) return '';

  const goal = PRIMARY_GOAL_LABELS[row.primary_goal] ?? row.primary_goal;
  const targetStyle = HAS_TARGET_LABELS[row.has_target] ?? row.has_target;
  const targets = formatTargets(row);
  const cadence = COACHING_FREQUENCY_LABELS[row.coaching_frequency] ?? row.coaching_frequency;
  const xp = EXPERIENCE_LEVEL_LABELS[row.experience_level] ?? row.experience_level;
  const notes = row.additional_notes?.trim()
    ? `Patient note for coach: ${row.additional_notes.trim()}`
    : 'No extra notes on file.';

  const phaseBanner = formatPhaseHomeLine(row);
  const phaseLabel =
    row.training_phase != null ? (TRAINING_PHASE_LABELS[row.training_phase] ?? row.training_phase) : null;
  const phaseBits = [
    phaseBanner ? `Periodization: ${phaseBanner}.` : '',
    phaseLabel && row.phase_started_at
      ? `Phase record: ${phaseLabel} from ${row.phase_started_at}${row.phase_target_end ? ` toward ${row.phase_target_end}` : ''}.`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  const daysOut = row.primary_goal === 'stage_ready' ? daysUntilTargetDate(row.target_date) : null;
  const weeksOut = row.primary_goal === 'stage_ready' ? weeksOutFromTargetDate(row.target_date) : null;
  const stageTone =
    row.primary_goal === 'stage_ready' && daysOut != null && daysOut <= 21
      ? `Show-prep coaching intensity: high focus — ${daysOut} day(s) to show date; match their cadence (${cadence}) but tighten accountability as the stage approaches.`
      : '';

  return [
    `Primary goal: ${goal}.`,
    `Target approach: ${targetStyle}. (${targets})`,
    weeksOut != null ? `Weeks out (approx): ${weeksOut}.` : '',
    `Preferred coaching cadence: ${cadence}.`,
    `Experience level (self-reported): ${xp}.`,
    phaseBits,
    stageTone,
    notes,
  ]
    .filter(Boolean)
    .join(' ');
}
