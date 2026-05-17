import type { PatientGoalsRow, TrainingPhaseId } from '@/lib/patientGoals';

export const TRAINING_PHASE_LABELS: Record<TrainingPhaseId, string> = {
  cut: 'Cut',
  bulk: 'Bulk',
  maintain: 'Maintain',
  stage_prep: 'Stage prep',
  recomp: 'Recomp',
};

/** "Cut Phase — Week 3 of 12" or partial if dates missing. */
export function formatPhaseHomeLine(row: PatientGoalsRow | null, now = new Date()): string | null {
  if (!row?.training_phase) return null;
  const label = TRAINING_PHASE_LABELS[row.training_phase] ?? row.training_phase;
  if (!row.phase_started_at) {
    return `${label} phase`;
  }
  const start = new Date(`${row.phase_started_at}T12:00:00`);
  const msDay = 86400000;
  const weekNum = Math.floor((now.getTime() - start.getTime()) / (7 * msDay)) + 1;
  const wk = Math.max(1, weekNum);
  if (!row.phase_target_end) {
    return `${label} phase — Week ${wk}`;
  }
  const end = new Date(`${row.phase_target_end}T12:00:00`);
  const totalWeeks = Math.max(1, Math.round((end.getTime() - start.getTime()) / (7 * msDay)));
  return `${label} phase — Week ${Math.min(wk, totalWeeks)} of ${totalWeeks}`;
}

/** Whole weeks until target_date (show day). */
export function weeksOutFromTargetDate(targetDateIso: string | null | undefined, now = new Date()): number | null {
  if (!targetDateIso) return null;
  const end = new Date(`${targetDateIso}T12:00:00`);
  const ms = end.getTime() - now.getTime();
  if (!Number.isFinite(ms)) return null;
  const days = Math.ceil(ms / 86400000);
  if (days < 0) return 0;
  return Math.max(0, Math.ceil(days / 7));
}

export function isPeakWeek(targetDateIso: string | null | undefined, now = new Date()): boolean {
  if (!targetDateIso) return false;
  const end = new Date(`${targetDateIso}T12:00:00`);
  const ms = end.getTime() - now.getTime();
  const days = Math.ceil(ms / 86400000);
  return days >= 0 && days <= 7;
}
