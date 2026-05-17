import { localDateKey } from '@/lib/patientSupplements';
import { supabase } from '@/lib/supabase';

export type WeightUnit = 'lb' | 'kg';

export type WeightLogRow = {
  id: string;
  patient_id: string;
  weight_value: number;
  unit: WeightUnit;
  logged_at: string;
  log_date: string;
};

const LB_PER_KG = 2.2046226218;

export function toPounds(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value * LB_PER_KG : value;
}

export function fromPounds(lbs: number, unit: WeightUnit): number {
  return unit === 'kg' ? lbs / LB_PER_KG : lbs;
}

export async function insertWeightLog(params: {
  patientId: string;
  weightValue: number;
  unit: WeightUnit;
  logDate?: string;
}): Promise<{ error: string | null }> {
  const logDate = params.logDate ?? localDateKey(new Date());
  const loggedAt = new Date().toISOString();
  const lbs = toPounds(params.weightValue, params.unit);
  const { error: wErr } = await supabase.from('weight_logs').insert({
    patient_id: params.patientId,
    weight_value: params.weightValue,
    unit: params.unit,
    logged_at: loggedAt,
    log_date: logDate,
  });
  if (wErr) return { error: wErr.message };

  const { error: vErr } = await supabase.from('vitality_scores').upsert(
    { patient_id: params.patientId, score_date: logDate, weight_lbs: Math.round(lbs * 10) / 10 },
    { onConflict: 'patient_id,score_date' },
  );
  if (vErr) {
    console.warn('[weight_logs] vitality_scores sync failed', vErr.message);
  }
  return { error: null };
}

export async function fetchWeightLogsForPatient(
  patientId: string,
  limit = 120,
): Promise<{ rows: WeightLogRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('weight_logs')
    .select('id, patient_id, weight_value, unit, logged_at, log_date')
    .eq('patient_id', patientId)
    .order('logged_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[weight_logs] fetch failed', error.message);
    return { rows: [], error: error.message };
  }
  const rows = (data ?? []).map((r) => ({
    id: String(r.id),
    patient_id: String(r.patient_id),
    weight_value: Number(r.weight_value),
    unit: (r.unit === 'kg' ? 'kg' : 'lb') as WeightUnit,
    logged_at: String(r.logged_at),
    log_date: String(r.log_date),
  }));
  return { rows, error: null };
}

/** Latest weight in pounds from weight_logs, or null. */
export async function fetchLatestWeightLbs(patientId: string): Promise<number | null> {
  const { rows } = await fetchWeightLogsForPatient(patientId, 1);
  const r = rows[0];
  if (!r) return null;
  return toPounds(r.weight_value, r.unit);
}
