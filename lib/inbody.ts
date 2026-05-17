import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { supabase } from '@/lib/supabase';

export type InBodyScan = {
  id: string;
  scan_date: string;
  weight_lbs: number | null;
  body_fat_percent: number | null;
  skeletal_muscle_lbs: number | null;
  bmi: number | null;
  bmr_kcal: number | null;
  visceral_fat_level: number | null;
  total_body_water_lbs: number | null;
  notes: string | null;
  provider_reviewed: boolean;
};

function mapRow(r: Record<string, unknown>): InBodyScan {
  return {
    id: String(r.id),
    scan_date: String(r.scan_date),
    weight_lbs: r.weight_lbs != null ? Number(r.weight_lbs) : null,
    body_fat_percent: r.body_fat_percent != null ? Number(r.body_fat_percent) : null,
    skeletal_muscle_lbs: r.skeletal_muscle_lbs != null ? Number(r.skeletal_muscle_lbs) : null,
    bmi: r.bmi != null ? Number(r.bmi) : null,
    bmr_kcal: r.bmr_kcal != null ? Number(r.bmr_kcal) : null,
    visceral_fat_level: r.visceral_fat_level != null ? Number(r.visceral_fat_level) : null,
    total_body_water_lbs: r.total_body_water_lbs != null ? Number(r.total_body_water_lbs) : null,
    notes: (r.notes as string | null) ?? null,
    provider_reviewed: r.provider_reviewed === true,
  };
}

const SELECT_FIELDS =
  'id, scan_date, weight_lbs, body_fat_percent, skeletal_muscle_lbs, bmi, bmr_kcal, visceral_fat_level, total_body_water_lbs, notes, provider_reviewed';

export async function listInBodyScansForAuthUser(authUserId: string): Promise<{ rows: InBodyScan[]; error: Error | null }> {
  const patientId = await fetchPatientIdForAuthUser(authUserId);
  if (!patientId) return { rows: [], error: null };
  const { data, error } = await supabase
    .from('inbody_scans')
    .select(SELECT_FIELDS)
    .eq('patient_id', patientId)
    .order('scan_date', { ascending: false })
    .limit(60);
  if (error) return { rows: [], error: new Error(error.message) };
  return { rows: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)), error: null };
}

export async function listInBodyScansForPatientId(patientId: string): Promise<{ rows: InBodyScan[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('inbody_scans')
    .select(SELECT_FIELDS)
    .eq('patient_id', patientId)
    .order('scan_date', { ascending: false })
    .limit(100);
  if (error) return { rows: [], error: new Error(error.message) };
  return { rows: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)), error: null };
}

export async function createInBodyScanForAuthUser(input: {
  authUserId: string;
  scan_date: string;
  weight_lbs: number | null;
  body_fat_percent: number | null;
  skeletal_muscle_lbs: number | null;
  bmi: number | null;
  bmr_kcal: number | null;
  visceral_fat_level: number | null;
  total_body_water_lbs: number | null;
  notes: string;
}): Promise<{ id: string | null; error: Error | null }> {
  const patientId = await fetchPatientIdForAuthUser(input.authUserId);
  if (!patientId) return { id: null, error: new Error('Patient profile missing') };

  const { data, error } = await supabase
    .from('inbody_scans')
    .insert({
      patient_id: patientId,
      scan_date: input.scan_date,
      weight_lbs: input.weight_lbs,
      body_fat_percent: input.body_fat_percent,
      skeletal_muscle_lbs: input.skeletal_muscle_lbs,
      bmi: input.bmi,
      bmr_kcal: input.bmr_kcal,
      visceral_fat_level: input.visceral_fat_level,
      total_body_water_lbs: input.total_body_water_lbs,
      notes: input.notes || null,
    })
    .select('id')
    .maybeSingle();
  if (error) return { id: null, error: new Error(error.message) };
  return { id: String(data?.id ?? ''), error: null };
}
