import { localDateKey } from '@/lib/patientSupplements';
import { supabase } from '@/lib/supabase';

export type RecoveryLogRow = {
  id: string;
  patient_id: string;
  log_date: string;
  sleep_hours: number | null;
  soreness_level: number | null;
  soreness_muscle_groups: string[];
  energy_level: number | null;
  stress_level: number | null;
};

const SORENESS_GROUPS = [
  'Legs',
  'Back',
  'Chest',
  'Shoulders',
  'Arms',
  'Core',
  'Full body',
] as const;

export { SORENESS_GROUPS };

export async function fetchRecoveryLogForDate(
  patientId: string,
  logDate: string,
): Promise<RecoveryLogRow | null> {
  const { data, error } = await supabase
    .from('recovery_logs')
    .select('*')
    .eq('patient_id', patientId)
    .eq('log_date', logDate)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function fetchRecoveryLogsRange(
  patientId: string,
  fromDate: string,
  toDate: string,
): Promise<RecoveryLogRow[]> {
  const { data, error } = await supabase
    .from('recovery_logs')
    .select('*')
    .eq('patient_id', patientId)
    .gte('log_date', fromDate)
    .lte('log_date', toDate)
    .order('log_date', { ascending: true });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapRow);
}

function mapRow(r: Record<string, unknown>): RecoveryLogRow {
  const groups = r.soreness_muscle_groups;
  return {
    id: String(r.id),
    patient_id: String(r.patient_id),
    log_date: String(r.log_date),
    sleep_hours: r.sleep_hours != null ? Number(r.sleep_hours) : null,
    soreness_level: r.soreness_level != null ? Number(r.soreness_level) : null,
    soreness_muscle_groups: Array.isArray(groups) ? groups.map(String) : [],
    energy_level: r.energy_level != null ? Number(r.energy_level) : null,
    stress_level: r.stress_level != null ? Number(r.stress_level) : null,
  };
}

export async function upsertRecoveryLog(input: {
  patientId: string;
  logDate?: string;
  sleep_hours: number | null;
  soreness_level: number | null;
  soreness_muscle_groups: string[];
  energy_level: number | null;
  stress_level: number | null;
}): Promise<{ error: string | null }> {
  const logDate = input.logDate ?? localDateKey(new Date());
  const { error } = await supabase.from('recovery_logs').upsert(
    {
      patient_id: input.patientId,
      log_date: logDate,
      sleep_hours: input.sleep_hours,
      soreness_level: input.soreness_level,
      soreness_muscle_groups: input.soreness_muscle_groups,
      energy_level: input.energy_level,
      stress_level: input.stress_level,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'patient_id,log_date' },
  );
  return { error: error?.message ?? null };
}
