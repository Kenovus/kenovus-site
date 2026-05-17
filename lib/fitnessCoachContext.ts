import { localDateKey } from '@/lib/patientSupplements';
import { fetchPatientGoals } from '@/lib/patientGoals';
import { formatPhaseHomeLine, isPeakWeek, weeksOutFromTargetDate } from '@/lib/phaseDisplay';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { fetchPatientTrainingPrefs, TRAINING_STYLE_LABELS, EQUIPMENT_LABELS } from '@/lib/patientTrainingPrefs';
import { fetchRecoveryLogsRange, type RecoveryLogRow } from '@/lib/recoveryLogs';
import {
  fetchPreviousTrainingLog,
  fetchTrainingLogs,
  formatExerciseSummary,
  progressiveOverloadHints,
  rirDriftWithoutLoad,
} from '@/lib/trainingLogs';
import { muscleFocusesBelowMevThisWeek, weeklySetsByMuscleFocus } from '@/lib/trainingVolumeLandmarks';

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Factual training / recovery / periodization block for My Coach. */
export async function buildFitnessCoachContextBlock(authUserId: string): Promise<string> {
  const patientId = await fetchPatientIdForAuthUser(authUserId);
  if (!patientId) return '';

  const today = localDateKey(new Date());
  const weekStart = addDays(today, -6);

  const [goals, prefs, logs, recovery] = await Promise.all([
    fetchPatientGoals(patientId),
    fetchPatientTrainingPrefs(patientId),
    fetchTrainingLogs(patientId, 12),
    fetchRecoveryLogsRange(patientId, weekStart, today),
  ]);

  const phaseLine = formatPhaseHomeLine(goals);
  const weeksOut =
    goals?.primary_goal === 'stage_ready' ? weeksOutFromTargetDate(goals.target_date) : null;
  const peak = goals?.primary_goal === 'stage_ready' ? isPeakWeek(goals.target_date) : false;

  const last3 = logs.slice(0, 3);
  const workoutSummaries = last3.map((l) => {
    const names = l.exercises.map((e) => formatExerciseSummary(e, l.weight_unit)).join('; ');
    return `${l.workout_date} ${l.muscle_focus}: ${names || 'no lifts logged'}`;
  });

  let overloadLine = 'Progressive overload (last session vs prior same focus): not enough history.';
  let rirLine = '';
  if (logs.length >= 1) {
    const cur = logs[0];
    const prev = await fetchPreviousTrainingLog(patientId, cur.muscle_focus, cur.id);
    if (prev) {
      const hints = progressiveOverloadHints(cur.exercises, prev.exercises);
      const vals = Object.values(hints);
      const ups = vals.filter((v) => v === 'up').length;
      const downs = vals.filter((v) => v === 'down').length;
      overloadLine = `Last ${cur.muscle_focus} session vs prior: ~${ups} lifts up, ~${downs} down (same-name compare by best-set volume).`;
      const drift = rirDriftWithoutLoad(cur.exercises, prev.exercises);
      const driftNames = Object.entries(drift)
        .filter(([, v]) => v)
        .map(([k]) => k);
      rirLine =
        driftNames.length > 0
          ? `RIR trend: for ${driftNames.join(', ')} average reps-in-reserve rose without load/volume increasing—flag gentle progressive overload (add load or reps within RIR 1–3).`
          : 'RIR trend: no clear “easier same load” pattern vs prior same-focus session.';
    }
  }

  const volMap = weeklySetsByMuscleFocus(logs);
  const volParts = Object.entries(volMap)
    .filter(([, n]) => n > 0)
    .map(([focus, n]) => `${focus}≈${n} sets`)
    .join(', ');
  const volSummary = volParts ? `This calendar week’s logged hard sets by focus: ${volParts}. Landmarks (RP-style weekly sets per focus): MEV ~8, MAV ~10–20, MRV ~20–25+.` : 'Weekly volume by focus: not enough logs yet.';
  const lowVol = muscleFocusesBelowMevThisWeek(logs);
  const mevCoach =
    lowVol.length > 0
      ? `Volume coach flag: ${lowVol.join(', ')} under ~MEV this week despite at least one session—member may benefit from gradually adding sets if recovery is good.`
      : '';

  const sessionsThisWeek = logs.filter((l) => l.workout_date >= weekStart && l.workout_date <= today).length;
  const goalDays = prefs?.training_days_per_week ?? 4;
  const styleLabel = prefs ? TRAINING_STYLE_LABELS[prefs.training_style] : 'unknown';
  const equipLabel = prefs ? EQUIPMENT_LABELS[prefs.equipment] : 'unknown';
  const freqLine = `Training this rolling 7d: ${sessionsThisWeek} session(s); goal ~${goalDays}/week. Style: ${styleLabel}; equipment: ${equipLabel}.`;

  const avgSleep =
    recovery.length && recovery.some((r: RecoveryLogRow) => r.sleep_hours != null)
      ? recovery.reduce((s: number, r: RecoveryLogRow) => s + (r.sleep_hours ?? 0), 0) /
        recovery.filter((r: RecoveryLogRow) => r.sleep_hours != null).length
      : null;
  const avgSore =
    recovery.length && recovery.some((r: RecoveryLogRow) => r.soreness_level != null)
      ? recovery.reduce((s: number, r: RecoveryLogRow) => s + (r.soreness_level ?? 0), 0) /
        recovery.filter((r: RecoveryLogRow) => r.soreness_level != null).length
      : null;
  const avgEnergy =
    recovery.length && recovery.some((r: RecoveryLogRow) => r.energy_level != null)
      ? recovery.reduce((s: number, r: RecoveryLogRow) => s + (r.energy_level ?? 0), 0) /
        recovery.filter((r: RecoveryLogRow) => r.energy_level != null).length
      : null;

  const recoveryLine = [
    recovery.length ? `Recovery logs (${weekStart}–${today}): ${recovery.length} day(s) with entries.` : 'No recovery check-ins this week.',
    avgSleep != null ? `Avg sleep (logged days): ${avgSleep.toFixed(1)}h.` : '',
    avgSore != null ? `Avg soreness 1–5: ${avgSore.toFixed(1)}.` : '',
    avgEnergy != null ? `Avg energy 1–5: ${avgEnergy.toFixed(1)}.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const stageLine =
    goals?.primary_goal === 'stage_ready' && weeksOut != null
      ? `Stage prep context: ~${weeksOut} week(s) out from show date${goals.target_date ? ` (${goals.target_date})` : ''}. Peak week window (final 7 days): ${peak ? 'yes — use educational peak-week framing only; always defer water/sodium manipulation to Simi Kennedy in person.' : 'no'}.`
      : '';

  const macroHint =
    goals?.phase_macro_adjustments && Object.keys(goals.phase_macro_adjustments).length
      ? `Phase macro notes (member-facing JSON hints): ${JSON.stringify(goals.phase_macro_adjustments)}.`
      : '';

  const phaseCoaching =
    goals?.training_phase === 'cut'
      ? 'Phase cue: cut — prioritize protein, muscle preservation, slightly lower training volume if recovery is poor.'
      : goals?.training_phase === 'bulk'
        ? 'Phase cue: bulk — progressive overload emphasis; sustainable surplus language only (no medical calorie prescriptions).'
        : goals?.training_phase === 'stage_prep' || goals?.primary_goal === 'stage_ready'
          ? 'Phase cue: stage prep / show — strict adherence tone without medical directives; peak week = educational + Simi-only for protocols.'
          : goals?.training_phase === 'maintain'
            ? 'Phase cue: maintain — consistency and sustainable habits.'
            : goals?.training_phase === 'recomp'
              ? 'Phase cue: recomp — balance strength work with recovery; protein-forward habits.'
              : '';

  const parts = [
    phaseLine ? `Training phase banner: ${phaseLine}.` : 'No explicit training phase set.',
    freqLine,
    workoutSummaries.length ? `Last workouts: ${workoutSummaries.join(' | ')}` : 'No training logs yet.',
    overloadLine,
    rirLine,
    volSummary,
    mevCoach,
    recoveryLine,
    stageLine,
    macroHint,
    phaseCoaching,
    'Reference recovery and training load briefly when relevant—no diagnosis. Encourage deload if soreness is high and sleep is low.',
  ].filter((p) => String(p).trim().length > 0);
  return parts.join(' ');
}
