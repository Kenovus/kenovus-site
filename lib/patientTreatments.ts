/**
 * PART 3 — Manual treatment and appointment CRUD.
 * No AR API — staff/patients log manually.
 */
import { supabase } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface PatientTreatment {
  id: string;
  patient_id: string;
  treatment_name: string;
  treatment_date: string;   // YYYY-MM-DD
  provider: string | null;
  notes: string | null;
  photos_urls: string[];
  created_at: string;
}

export interface PatientAppointment {
  id: string;
  patient_id: string;
  treatment_name: string;
  appointment_date: string; // YYYY-MM-DD
  appointment_time: string | null; // HH:MM
  provider: string | null;
  status: 'upcoming' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
}

export interface PatientCheckin {
  id: string;
  patient_id: string;
  treatment_name: string;
  treatment_date: string;
  n_day: number; // 1, 2, 3 (24hr, 48hr, 72hr)
  symptoms_json: Record<string, number>; // { bruising: 3, swelling: 5, pain: 2, nausea: 0 }
  notes: string | null;
  photo_url: string | null;
  simi_flagged: boolean;
  created_at: string;
}

// ── APPOINTMENTS ──────────────────────────────────────────────────────────────
export async function fetchUpcomingAppointments(patientId: string): Promise<PatientAppointment[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('patient_appointments')
    .select('*')
    .eq('patient_id', patientId)
    .eq('status', 'upcoming')
    .gte('appointment_date', today)
    .order('appointment_date');
  if (error) { console.warn('[appointments] fetch error', error); return []; }
  return (data ?? []) as PatientAppointment[];
}

export async function fetchAllAppointments(patientId: string): Promise<PatientAppointment[]> {
  const { data, error } = await supabase
    .from('patient_appointments')
    .select('*')
    .eq('patient_id', patientId)
    .order('appointment_date', { ascending: false });
  if (error) { console.warn('[appointments] fetch all error', error); return []; }
  return (data ?? []) as PatientAppointment[];
}

export async function addAppointment(appt: Omit<PatientAppointment, 'id' | 'created_at'>): Promise<{ error: string | null }> {
  const { error } = await supabase.from('patient_appointments').insert(appt);
  return { error: error?.message ?? null };
}

export async function updateAppointmentStatus(
  id: string,
  status: PatientAppointment['status'],
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('patient_appointments')
    .update({ status })
    .eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteAppointment(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('patient_appointments').delete().eq('id', id);
  return { error: error?.message ?? null };
}

// ── TREATMENTS ────────────────────────────────────────────────────────────────
export async function fetchTreatmentHistory(patientId: string, limit = 20): Promise<PatientTreatment[]> {
  const { data, error } = await supabase
    .from('patient_treatments')
    .select('*')
    .eq('patient_id', patientId)
    .order('treatment_date', { ascending: false })
    .limit(limit);
  if (error) { console.warn('[treatments] fetch error', error); return []; }
  return (data ?? []) as PatientTreatment[];
}

export async function addTreatment(treatment: Omit<PatientTreatment, 'id' | 'created_at'>): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('patient_treatments')
    .insert({ ...treatment, photos_urls: treatment.photos_urls ?? [] })
    .select('id')
    .single();
  return { id: data?.id ?? null, error: error?.message ?? null };
}

// ── CHECKINS ──────────────────────────────────────────────────────────────────
export async function saveCheckin(checkin: Omit<PatientCheckin, 'id' | 'created_at'>): Promise<{ error: string | null }> {
  // Flag to provider if any symptom >= 7
  const maxSymptom = Math.max(...Object.values(checkin.symptoms_json));
  const { error } = await supabase.from('patient_checkins').insert({
    ...checkin,
    simi_flagged: maxSymptom >= 7,
  });
  return { error: error?.message ?? null };
}

export async function fetchCheckins(patientId: string, treatmentDate?: string): Promise<PatientCheckin[]> {
  let query = supabase
    .from('patient_checkins')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  if (treatmentDate) query = query.eq('treatment_date', treatmentDate);
  const { data, error } = await query.limit(20);
  if (error) return [];
  return (data ?? []) as PatientCheckin[];
}

// ── Upcoming checkins check (automation trigger) ───────────────────────────────
/** Returns treatments that need a check-in notification (24/48/72 hrs after treatment) */
export async function getCheckinsDue(patientId: string): Promise<{ treatment: PatientTreatment; n_day: number }[]> {
  const now = Date.now();
  const treatments = await fetchTreatmentHistory(patientId, 10);
  const results: { treatment: PatientTreatment; n_day: number }[] = [];

  for (const t of treatments) {
    const treatDate = new Date(`${t.treatment_date}T12:00:00`).getTime();
    const hoursAgo = (now - treatDate) / 3600000;

    for (const n_day of [1, 2, 3]) {
      const windowCenter = n_day * 24;
      if (Math.abs(hoursAgo - windowCenter) < 4) {
        // Within ±4 hours of the check-in window
        const existingCheckins = await fetchCheckins(patientId, t.treatment_date);
        const alreadyDone = existingCheckins.some((c) => c.n_day === n_day);
        if (!alreadyDone) results.push({ treatment: t, n_day });
      }
    }
  }
  return results;
}

// ── Supabase table migration SQL (run once in Supabase dashboard) ──────────────
export const MIGRATION_SQL = `
-- patient_appointments (manual entry, no AR API)
CREATE TABLE IF NOT EXISTS patient_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  treatment_name TEXT NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TEXT,
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','completed','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_appts_patient ON patient_appointments(patient_id, appointment_date);

-- patient_treatments (past treatment history log)
CREATE TABLE IF NOT EXISTS patient_treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  treatment_name TEXT NOT NULL,
  treatment_date DATE NOT NULL,
  provider TEXT,
  notes TEXT,
  photos_urls JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_treats_patient ON patient_treatments(patient_id, treatment_date DESC);

-- patient_checkins (post-treatment recovery check-ins)
CREATE TABLE IF NOT EXISTS patient_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  treatment_name TEXT NOT NULL,
  treatment_date DATE NOT NULL,
  n_day SMALLINT NOT NULL CHECK (n_day IN (1,2,3)),
  symptoms_json JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  photo_url TEXT,
  simi_flagged BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_checkins_patient ON patient_checkins(patient_id, treatment_date DESC);
`;
