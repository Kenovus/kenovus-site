import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { supabase } from '@/lib/supabase';

export type LabResultRow = {
  id: string;
  lab_date: string;
  panel_name: string | null;
  hba1c: number | null;
  total_cholesterol: number | null;
  ldl: number | null;
  hdl: number | null;
  triglycerides: number | null;
  provider_notes: string | null;
};

const SELECT =
  'id, lab_date, panel_name, hba1c, total_cholesterol, ldl, hdl, triglycerides, provider_notes';

function mapRow(r: Record<string, unknown>): LabResultRow {
  return {
    id: String(r.id),
    lab_date: String(r.lab_date),
    panel_name: (r.panel_name as string | null) ?? null,
    hba1c: r.hba1c != null ? Number(r.hba1c) : null,
    total_cholesterol: r.total_cholesterol != null ? Number(r.total_cholesterol) : null,
    ldl: r.ldl != null ? Number(r.ldl) : null,
    hdl: r.hdl != null ? Number(r.hdl) : null,
    triglycerides: r.triglycerides != null ? Number(r.triglycerides) : null,
    provider_notes: (r.provider_notes as string | null) ?? null,
  };
}

export async function listLabResultsForAuthUser(
  authUserId: string,
): Promise<{ rows: LabResultRow[]; error: Error | null }> {
  const patientId = await fetchPatientIdForAuthUser(authUserId);
  if (!patientId) return { rows: [], error: null };
  const { data, error } = await supabase
    .from('lab_results')
    .select(SELECT)
    .eq('patient_id', patientId)
    .order('lab_date', { ascending: false })
    .limit(48);
  if (error) return { rows: [], error: new Error(error.message) };
  return { rows: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)), error: null };
}

export async function createLabResultForAuthUser(input: {
  authUserId: string;
  lab_date: string;
  panel_name: string | null;
  provider_notes: string | null;
  hba1c: number | null;
  total_cholesterol: number | null;
  ldl: number | null;
  hdl: number | null;
  triglycerides: number | null;
}): Promise<{ id: string | null; error: Error | null }> {
  const patientId = await fetchPatientIdForAuthUser(input.authUserId);
  if (!patientId) return { id: null, error: new Error('Patient profile missing') };

  const { data, error } = await supabase
    .from('lab_results')
    .insert({
      patient_id: patientId,
      lab_date: input.lab_date,
      panel_name: input.panel_name,
      provider_notes: input.provider_notes,
      hba1c: input.hba1c,
      total_cholesterol: input.total_cholesterol,
      ldl: input.ldl,
      hdl: input.hdl,
      triglycerides: input.triglycerides,
    })
    .select('id')
    .maybeSingle();
  if (error) return { id: null, error: new Error(error.message) };
  return { id: String(data?.id ?? ''), error: null };
}
