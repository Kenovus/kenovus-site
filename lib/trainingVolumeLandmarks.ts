import type { TrainingLogRow } from '@/lib/trainingLogs';
import { totalWorkingSetsForLog } from '@/lib/trainingLogs';

export const MEV_SETS = 8;
export const MAV_LOW = 10;
export const MAV_HIGH = 20;
export const MRV_LOW = 20;
export const MRV_HIGH = 25;

/** Sum working sets this calendar week (Mon–Sun, device-local) per muscle_focus. */
export function weeklySetsByMuscleFocus(logs: TrainingLogRow[], weekAnchor = new Date()): Record<string, number> {
  const day = weekAnchor.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(weekAnchor);
  mon.setDate(weekAnchor.getDate() + diffToMon);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const from = iso(mon);
  const to = iso(sun);

  const out: Record<string, number> = {};
  for (const log of logs) {
    if (log.workout_date < from || log.workout_date > to) continue;
    const n = totalWorkingSetsForLog(log);
    out[log.muscle_focus] = (out[log.muscle_focus] ?? 0) + n;
  }
  return out;
}

export function volumeLandmarkLabel(totalSets: number): 'below_mev' | 'mev_mav' | 'mav' | 'mrv' | 'above_mrv' {
  if (totalSets < MEV_SETS) return 'below_mev';
  if (totalSets < MAV_LOW) return 'mev_mav';
  if (totalSets <= MAV_HIGH) return 'mav';
  if (totalSets <= MRV_HIGH) return 'mrv';
  return 'above_mrv';
}

/** Muscle_focus keys with rolling-week set totals under MEV despite at least one session this week. */
export function muscleFocusesBelowMevThisWeek(logs: TrainingLogRow[], weekAnchor = new Date()): string[] {
  const totals = weeklySetsByMuscleFocus(logs, weekAnchor);
  const mon = new Date(weekAnchor);
  const day = weekAnchor.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  mon.setDate(weekAnchor.getDate() + diffToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const from = iso(mon);
  const to = iso(sun);
  const hadSession = new Set<string>();
  for (const log of logs) {
    if (log.workout_date >= from && log.workout_date <= to) hadSession.add(log.muscle_focus);
  }
  const out: string[] = [];
  for (const focus of hadSession) {
    if ((totals[focus] ?? 0) < MEV_SETS) out.push(focus);
  }
  return out;
}
