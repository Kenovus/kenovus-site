import { supabase } from '@/lib/supabase';
import { CURATED_SUPPLEMENT_PRESETS, curatedLabelForPresetKey } from '@/lib/supplements/curatedPresets';
import type { WeeklySupplementConsistency } from '@/lib/supplements/curatedPresets';

export type PatientSupplementRow = {
  id: string;
  patient_id: string;
  preset_key: string | null;
  custom_name: string | null;
  /** Canonical display name required by some DB schemas (mirrors preset label or custom name). */
  supplement_name?: string | null;
  dose: string;
  frequency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function resolveSupplementName(
  presetKey: string | null | undefined,
  customName: string | null | undefined,
): string {
  if (presetKey) return curatedLabelForPresetKey(presetKey);
  const c = (customName ?? '').trim();
  return c || 'Custom supplement';
}

export type PatientSupplementDailyLogRow = {
  id: string;
  patient_id: string;
  supplement_id: string;
  log_date: string;
  taken: boolean;
};

export type MergedSupplementItem = {
  id: string | null;
  presetKey: string | null;
  displayName: string;
  dose: string;
  frequency: string;
  isActive: boolean;
  isCustom: boolean;
};

export function mergeSupplementsForUi(rows: PatientSupplementRow[]): MergedSupplementItem[] {
  const customRows = rows.filter((r) => r.preset_key == null && (r.custom_name?.trim() ?? '') !== '');
  const curated: MergedSupplementItem[] = CURATED_SUPPLEMENT_PRESETS.map((p) => {
    const r = rows.find((x) => x.preset_key === p.key);
    const displayName = r
      ? r.supplement_name?.trim() || curatedLabelForPresetKey(p.key)
      : p.label;
    return {
      id: r?.id ?? null,
      presetKey: p.key,
      displayName,
      dose: r?.dose ?? '',
      frequency: r?.frequency ?? '',
      isActive: r?.is_active ?? false,
      isCustom: false,
    };
  });
  const customs: MergedSupplementItem[] = customRows.map((r) => ({
    id: r.id,
    presetKey: null,
    displayName:
      r.supplement_name?.trim() || (r.custom_name ?? '').trim() || resolveSupplementName(null, r.custom_name),
    dose: r.dose ?? '',
    frequency: r.frequency ?? '',
    isActive: r.is_active,
    isCustom: true,
  }));
  return [...curated, ...customs];
}

export async function fetchPatientSupplements(patientId: string): Promise<PatientSupplementRow[]> {
  const { data, error } = await supabase
    .from('patient_supplements')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('[patientSupplements] fetch failed', error.message);
    return [];
  }
  return (data ?? []) as PatientSupplementRow[];
}

export async function fetchDailyLogsForDate(
  patientId: string,
  logDate: string,
): Promise<PatientSupplementDailyLogRow[]> {
  const { data, error } = await supabase
    .from('patient_supplement_daily_logs')
    .select('*')
    .eq('patient_id', patientId)
    .eq('log_date', logDate);
  if (error) {
    console.warn('[patientSupplements] fetch logs failed', error.message);
    return [];
  }
  return (data ?? []) as PatientSupplementDailyLogRow[];
}

export async function upsertPatientSupplement(params: {
  patientId: string;
  id?: string | null;
  presetKey?: string | null;
  customName?: string | null;
  dose: string;
  frequency: string;
  isActive: boolean;
}): Promise<{ id: string | null; error: string | null }> {
  const { patientId, id, presetKey, customName, dose, frequency, isActive } = params;
  const now = new Date().toISOString();

  if (presetKey) {
    const supplement_name = resolveSupplementName(presetKey, null);
    const { data, error } = await supabase
      .from('patient_supplements')
      .upsert(
        {
          patient_id: patientId,
          preset_key: presetKey,
          custom_name: null,
          supplement_name,
          dose,
          frequency,
          is_active: isActive,
          updated_at: now,
        },
        { onConflict: 'patient_id,preset_key' },
      )
      .select('id')
      .maybeSingle();
    if (error) return { id: null, error: error.message };
    return { id: data?.id ?? null, error: null };
  }

  if (id) {
    const patch: Record<string, unknown> = {
      dose,
      frequency,
      is_active: isActive,
      updated_at: now,
    };
    if (customName != null) {
      patch.custom_name = customName;
      patch.supplement_name = resolveSupplementName(null, customName);
    }
    const { data, error } = await supabase
      .from('patient_supplements')
      .update(patch)
      .eq('id', id)
      .eq('patient_id', patientId)
      .select('id')
      .maybeSingle();
    if (error) return { id: null, error: error.message };
    return { id: data?.id ?? id, error: null };
  }

  const { data, error } = await supabase
    .from('patient_supplements')
    .insert({
      patient_id: patientId,
      preset_key: null,
      custom_name: customName ?? null,
      supplement_name: resolveSupplementName(null, customName),
      dose,
      frequency,
      is_active: isActive,
      updated_at: now,
    })
    .select('id')
    .maybeSingle();
  if (error) return { id: null, error: error.message };
  return { id: data?.id ?? null, error: null };
}

export async function deletePatientSupplement(patientId: string, id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('patient_supplements').delete().eq('id', id).eq('patient_id', patientId);
  return { error: error?.message ?? null };
}

export async function setDailySupplementLog(params: {
  patientId: string;
  supplementId: string;
  logDate: string;
  taken: boolean;
}): Promise<{ error: string | null }> {
  const { patientId, supplementId, logDate, taken } = params;
  const { data: existing } = await supabase
    .from('patient_supplement_daily_logs')
    .select('id')
    .eq('supplement_id', supplementId)
    .eq('log_date', logDate)
    .maybeSingle();
  const now = new Date().toISOString();
  if (existing?.id) {
    const { error } = await supabase
      .from('patient_supplement_daily_logs')
      .update({ taken, updated_at: now })
      .eq('id', existing.id);
    return { error: error?.message ?? null };
  }
  const { error } = await supabase.from('patient_supplement_daily_logs').insert({
    patient_id: patientId,
    supplement_id: supplementId,
    log_date: logDate,
    taken,
    updated_at: now,
  });
  return { error: error?.message ?? null };
}

/** Last calendar date (YYYY-MM-DD) this supplement was marked taken, or null. */
export async function fetchLastTakenDate(
  patientId: string,
  supplementId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('patient_supplement_daily_logs')
    .select('log_date')
    .eq('patient_id', patientId)
    .eq('supplement_id', supplementId)
    .eq('taken', true)
    .order('log_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.log_date) return null;
  return data.log_date as string;
}

/** Adherence counts for last `days` days per supplement (active only in caller). */
export async function fetchAdherenceSummary(
  patientId: string,
  supplementIds: string[],
  days: number,
): Promise<Record<string, { takenDays: number; loggedDays: number }>> {
  const out: Record<string, { takenDays: number; loggedDays: number }> = {};
  if (supplementIds.length === 0) return out;
  const end = new Date();
  end.setHours(12, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  const from = localDateKey(start);
  const to = localDateKey(end);
  const { data, error } = await supabase
    .from('patient_supplement_daily_logs')
    .select('supplement_id, log_date, taken')
    .eq('patient_id', patientId)
    .gte('log_date', from)
    .lte('log_date', to)
    .in('supplement_id', supplementIds);
  if (error || !data) return out;
  for (const id of supplementIds) {
    out[id] = { takenDays: 0, loggedDays: 0 };
  }
  for (const row of data as { supplement_id: string; taken: boolean }[]) {
    if (!out[row.supplement_id]) out[row.supplement_id] = { takenDays: 0, loggedDays: 0 };
    out[row.supplement_id].loggedDays += 1;
    if (row.taken) out[row.supplement_id].takenDays += 1;
  }
  return out;
}

export function localDateKey(d = new Date()): string {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Anchor date for “this week” Sunday check-in (local noon, then zero to Sunday). Uses device local calendar, not UTC. */
export function getWeeklySundayAnchor(d = new Date()): string {
  const copy = new Date(d);
  copy.setHours(12, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? 0 : -day;
  copy.setDate(copy.getDate() + diff);
  return localDateKey(copy);
}

/**
 * Week for supplement reflection = Sun–Sat ending on the most recent Saturday (local).
 * Anchor is that week’s Sunday (YYYY-MM-DD, device local). Matches Sat ≥18:00 and Sun ≥17:00 prompts.
 */
export function getWeeklySupplementRetroAnchor(d = new Date()): string {
  const copy = new Date(d);
  copy.setHours(12, 0, 0, 0);
  const dow = copy.getDay();
  const lastSat = new Date(copy);
  lastSat.setDate(lastSat.getDate() - ((dow - 6 + 7) % 7));
  const weekStartSun = new Date(lastSat);
  weekStartSun.setDate(weekStartSun.getDate() - 6);
  weekStartSun.setHours(12, 0, 0, 0);
  return localDateKey(weekStartSun);
}

/** Sat ≥18:00 or Sun ≥17:00 local — end-of-week supplement check-in window. */
export function isWeeklySupplementCheckinWindow(d = new Date()): boolean {
  const dow = d.getDay();
  const h = d.getHours();
  if (dow === 6) return h >= 18;
  if (dow === 0) return h >= 17;
  return false;
}

export async function fetchWeeklyCheckinForAnchor(
  patientId: string,
  weekAnchor: string,
): Promise<{ consistency: WeeklySupplementConsistency; ai_reply: string | null } | null> {
  const { data, error } = await supabase
    .from('patient_supplement_weekly_checkins')
    .select('consistency, ai_reply')
    .eq('patient_id', patientId)
    .eq('week_anchor', weekAnchor)
    .maybeSingle();
  if (error || !data) return null;
  return {
    consistency: data.consistency as WeeklySupplementConsistency,
    ai_reply: (data.ai_reply as string | null) ?? null,
  };
}

export async function saveWeeklySupplementCheckin(params: {
  patientId: string;
  weekAnchor: string;
  consistency: WeeklySupplementConsistency;
  aiReply: string;
}): Promise<{ error: string | null }> {
  const { patientId, weekAnchor, consistency, aiReply } = params;
  const { error } = await supabase.from('patient_supplement_weekly_checkins').upsert(
    {
      patient_id: patientId,
      week_anchor: weekAnchor,
      consistency,
      ai_reply: aiReply,
    },
    { onConflict: 'patient_id,week_anchor' },
  );
  return { error: error?.message ?? null };
}
