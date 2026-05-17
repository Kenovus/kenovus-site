import { supabase } from '@/lib/supabase';
import type { WeightUnit } from '@/lib/weightLogs';

export type TrainingSetRow = {
  reps: number;
  weight: number;
  /** Reps in reserve 0–4 (0 = failure). */
  rir: number | null;
};

export type TrainingExercise = {
  name: string;
  /** Per-set logging (preferred). */
  set_rows?: TrainingSetRow[] | null;
  /** Legacy single-line summary when `set_rows` absent. */
  sets?: number;
  reps?: number;
  weight?: number;
};

export type TrainingLogRow = {
  id: string;
  patient_id: string;
  workout_date: string;
  muscle_focus: string;
  exercises: TrainingExercise[];
  duration_minutes: number | null;
  notes: string | null;
  weight_unit: WeightUnit;
  created_at: string;
};

export const MUSCLE_FOCUS_OPTIONS = [
  { id: 'full_body', label: 'Full body' },
  { id: 'upper', label: 'Upper' },
  { id: 'lower', label: 'Lower' },
  { id: 'push', label: 'Push' },
  { id: 'pull', label: 'Pull' },
  { id: 'legs', label: 'Legs' },
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'arms', label: 'Arms' },
  { id: 'core', label: 'Core' },
] as const;

const DEFAULT_RIR = 2;

function parseSetRows(raw: unknown): TrainingSetRow[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const rows: TrainingSetRow[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const reps = Math.max(0, Math.round(Number(o.reps) || 0));
    const weight = Number.isFinite(Number(o.weight)) ? Number(o.weight) : 0;
    const rirRaw = o.rir;
    const rir =
      rirRaw === null || rirRaw === undefined || rirRaw === ''
        ? null
        : Math.max(0, Math.min(4, Math.round(Number(rirRaw))));
    rows.push({ reps, weight, rir: Number.isFinite(Number(rirRaw)) ? rir : null });
  }
  return rows.length ? rows : null;
}

/** Canonical per-set rows for an exercise (for math + UI). */
export function normalizeExerciseSets(ex: TrainingExercise): TrainingSetRow[] {
  const sr = parseSetRows(ex.set_rows);
  if (sr && sr.length) return sr;
  const n = Math.max(1, Math.round(Number(ex.sets) || 1));
  const reps = Math.max(0, Math.round(Number(ex.reps) || 0));
  const weight = Number.isFinite(Number(ex.weight)) ? Number(ex.weight) : 0;
  return Array.from({ length: n }, () => ({ reps, weight, rir: DEFAULT_RIR as number | null }));
}

export function exerciseWorkingSetCount(ex: TrainingExercise): number {
  return normalizeExerciseSets(ex).length;
}

export function totalWorkingSetsForLog(log: TrainingLogRow): number {
  return log.exercises.reduce((s, e) => s + exerciseWorkingSetCount(e), 0);
}

export function exerciseBestSetVolume(ex: TrainingExercise): number {
  return Math.max(0, ...normalizeExerciseSets(ex).map((r) => r.weight * r.reps));
}

function avgRirForExercise(ex: TrainingExercise): number | null {
  const rows = normalizeExerciseSets(ex);
  const vals = rows.map((r) => r.rir).filter((x): x is number => x != null && Number.isFinite(x));
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function parseExercises(raw: unknown): TrainingExercise[] {
  if (!Array.isArray(raw)) return [];
  const out: TrainingExercise[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const name = String(o.name ?? '').trim();
    if (!name) continue;
    const setRows = parseSetRows(o.set_rows);
    if (setRows) {
      out.push({ name, set_rows: setRows });
    } else {
      out.push({
        name,
        sets: Math.max(0, Math.round(Number(o.sets) || 0)),
        reps: Math.max(0, Math.round(Number(o.reps) || 0)),
        weight: Number.isFinite(Number(o.weight)) ? Number(o.weight) : 0,
      });
    }
  }
  return out;
}

function mapRow(r: Record<string, unknown>): TrainingLogRow {
  return {
    id: String(r.id),
    patient_id: String(r.patient_id),
    workout_date: String(r.workout_date),
    muscle_focus: String(r.muscle_focus),
    exercises: parseExercises(r.exercises),
    duration_minutes: r.duration_minutes != null ? Number(r.duration_minutes) : null,
    notes: r.notes != null ? String(r.notes) : null,
    weight_unit: r.weight_unit === 'kg' ? 'kg' : 'lb',
    created_at: String(r.created_at),
  };
}

export async function fetchTrainingLogs(patientId: string, limit = 40): Promise<TrainingLogRow[]> {
  const { data, error } = await supabase
    .from('training_logs')
    .select('*')
    .eq('patient_id', patientId)
    .order('workout_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapRow);
}

/** Most recent log for this muscle focus (excluding optional id). */
export async function fetchPreviousTrainingLog(
  patientId: string,
  muscleFocus: string,
  excludeId?: string,
): Promise<TrainingLogRow | null> {
  const { data, error } = await supabase
    .from('training_logs')
    .select('*')
    .eq('patient_id', patientId)
    .eq('muscle_focus', muscleFocus)
    .order('workout_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(5);
  if (error || !data?.length) return null;
  const rows = (data as Record<string, unknown>[]).map(mapRow);
  const pick = excludeId ? rows.find((r) => r.id !== excludeId) : rows[0];
  return pick ?? null;
}

export async function fetchLatestTrainingLog(patientId: string): Promise<TrainingLogRow | null> {
  const { data, error } = await supabase
    .from('training_logs')
    .select('*')
    .eq('patient_id', patientId)
    .order('workout_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

export type OverloadHint = 'up' | 'down' | 'same' | 'unknown';

/** Compare each exercise by name to previous session: best single-set volume proxy max(weight*reps). */
export function progressiveOverloadHints(
  current: TrainingExercise[],
  previous: TrainingExercise[] | null,
): Record<string, OverloadHint> {
  const out: Record<string, OverloadHint> = {};
  if (!previous?.length) {
    for (const e of current) out[e.name] = 'unknown';
    return out;
  }
  const prevBest = new Map<string, number>();
  for (const e of previous) {
    const v = exerciseBestSetVolume(e);
    prevBest.set(e.name, Math.max(prevBest.get(e.name) ?? 0, v));
  }
  for (const e of current) {
    const v = exerciseBestSetVolume(e);
    const p = prevBest.get(e.name);
    if (p == null) {
      out[e.name] = 'unknown';
      continue;
    }
    if (v > p * 1.01) out[e.name] = 'up';
    else if (v < p * 0.99) out[e.name] = 'down';
    else out[e.name] = 'same';
  }
  return out;
}

/** True when load/volume is flat or down but average RIR is meaningfully higher than last same-focus session. */
export function rirDriftWithoutLoad(current: TrainingExercise[], previous: TrainingExercise[] | null): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!previous?.length) {
    for (const e of current) out[e.name] = false;
    return out;
  }
  const prevMap = new Map<string, { vol: number; rir: number | null }>();
  for (const e of previous) {
    const vol = exerciseBestSetVolume(e);
    const rir = avgRirForExercise(e);
    prevMap.set(e.name, { vol: Math.max(prevMap.get(e.name)?.vol ?? 0, vol), rir });
  }
  for (const e of current) {
    const p = prevMap.get(e.name);
    const curVol = exerciseBestSetVolume(e);
    const curRir = avgRirForExercise(e);
    if (!p || p.rir == null || curRir == null) {
      out[e.name] = false;
      continue;
    }
    const volFlat = curVol <= p.vol * 1.02;
    const rirUp = curRir >= p.rir + 0.75;
    out[e.name] = volFlat && rirUp;
  }
  return out;
}

export type PrHit = { exercise: string; weight: number };

export function detectNewPrs(exercises: TrainingExercise[], historicalMaxByName: Map<string, number>): PrHit[] {
  const hits: PrHit[] = [];
  for (const e of exercises) {
    const ws = normalizeExerciseSets(e).map((r) => r.weight);
    const peak = ws.length ? Math.max(...ws) : 0;
    const prev = historicalMaxByName.get(e.name.toLowerCase()) ?? 0;
    if (peak > prev + 0.01) {
      hits.push({ exercise: e.name, weight: peak });
      historicalMaxByName.set(e.name.toLowerCase(), peak);
    }
  }
  return hits;
}

export async function buildHistoricalMaxWeightMap(patientId: string, unit: WeightUnit): Promise<Map<string, number>> {
  const logs = await fetchTrainingLogs(patientId, 80);
  const map = new Map<string, number>();
  for (const log of logs) {
    if (log.weight_unit !== unit) continue;
    for (const e of log.exercises) {
      const k = e.name.toLowerCase();
      const ws = normalizeExerciseSets(e).map((r) => r.weight);
      const peak = ws.length ? Math.max(...ws) : 0;
      map.set(k, Math.max(map.get(k) ?? 0, peak));
    }
  }
  return map;
}

/** Persist shape: always include `set_rows` when present in memory. */
export function formatExerciseSummary(ex: TrainingExercise, unit: WeightUnit): string {
  const rows = normalizeExerciseSets(ex);
  const u = unit === 'kg' ? 'kg' : 'lb';
  const bits = rows.map((r) => `${r.reps}@${r.weight}${u}${r.rir != null ? ` R${r.rir}` : ''}`);
  return `${ex.name}: ${rows.length} set(s) — ${bits.join(' · ')}`;
}

export async function insertTrainingLog(input: {
  patientId: string;
  workout_date: string;
  muscle_focus: string;
  exercises: TrainingExercise[];
  duration_minutes: number | null;
  notes: string | null;
  weight_unit: WeightUnit;
}): Promise<{ row: TrainingLogRow | null; error: string | null }> {
  const payload = input.exercises.map((e) => {
    const rows = normalizeExerciseSets(e);
    return { name: e.name.trim(), set_rows: rows };
  });
  const { data, error } = await supabase
    .from('training_logs')
    .insert({
      patient_id: input.patientId,
      workout_date: input.workout_date,
      muscle_focus: input.muscle_focus,
      exercises: payload,
      duration_minutes: input.duration_minutes,
      notes: input.notes,
      weight_unit: input.weight_unit,
    })
    .select('*')
    .single();
  if (error || !data) {
    return { row: null, error: error?.message ?? 'insert failed' };
  }
  return { row: mapRow(data as Record<string, unknown>), error: null };
}
