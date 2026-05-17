import { anthropicMessages } from '@/lib/anthropic';
import { supabase } from '@/lib/supabase';

type RoiMetrics = {
  patientCount: number;
  active30d: number;
  retentionRate: number;
  engagementActions30d: number;
  engagementPerPatient30d: number;
  revenue30d: number;
  valuePerActivePatient30d: number;
  appointmentsCompleted30d: number;
};

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function fallbackReport(clinicName: string, m: RoiMetrics): string {
  return [
    `${clinicName} ROI Summary (${isoDaysAgo(30)} to ${isoDaysAgo(0)})`,
    `Retention: ${(m.retentionRate * 100).toFixed(1)}% active in last 30 days (${m.active30d}/${m.patientCount}).`,
    `Engagement: ${m.engagementActions30d} tracked actions (${m.engagementPerPatient30d.toFixed(1)} per patient).`,
    `Value delivered: $${Math.round(m.revenue30d).toLocaleString()} in 30-day revenue, ~$${Math.round(m.valuePerActivePatient30d).toLocaleString()} per active patient.`,
    `Care operations: ${m.appointmentsCompleted30d} completed appointments.`,
  ].join('\n');
}

async function computeClinicRoiMetrics(clinicId: string): Promise<{ metrics: RoiMetrics; clinicName: string }> {
  const start = isoDaysAgo(30);
  const end = isoDaysAgo(0);

  const [{ data: clinic }, { data: patients, error: patientErr }] = await Promise.all([
    supabase.from('clinics').select('name').eq('id', clinicId).maybeSingle(),
    supabase.from('patients').select('id, last_active_at').eq('clinic_id', clinicId).eq('is_active', true),
  ]);
  if (patientErr) throw new Error(patientErr.message);
  const patientIds = (patients ?? []).map((p) => p.id);

  const [
    { data: checklist, error: checklistErr },
    { data: food, error: foodErr },
    { data: tx, error: txErr },
    { data: appts, error: apptErr },
  ] = await Promise.all([
    patientIds.length
      ? supabase
          .from('daily_checklist_items')
          .select('id')
          .eq('completed', true)
          .gte('checklist_date', start)
          .in('patient_id', patientIds)
      : Promise.resolve({ data: [], error: null } as { data: Array<{ id: string }>; error: null }),
    patientIds.length
      ? supabase.from('food_log_entries').select('id').gte('log_date', start).in('patient_id', patientIds)
      : Promise.resolve({ data: [], error: null } as { data: Array<{ id: string }>; error: null }),
    supabase.from('financial_transactions').select('amount, is_refund').eq('clinic_id', clinicId).gte('transaction_date', start),
    supabase
      .from('appointments')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('status', 'completed')
      .gte('appointment_date', start)
      .lte('appointment_date', end),
  ]);

  if (checklistErr) throw new Error(checklistErr.message);
  if (foodErr) throw new Error(foodErr.message);
  if (txErr) throw new Error(txErr.message);
  if (apptErr) throw new Error(apptErr.message);

  const patientCount = (patients ?? []).length;
  const active30d = (patients ?? []).filter((p) => {
    if (!p.last_active_at) return false;
    return new Date(String(p.last_active_at)).getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000;
  }).length;
  const engagementActions30d = (checklist?.length ?? 0) + (food?.length ?? 0);
  const revenue30d = (tx ?? []).reduce((acc, r) => {
    const amt = Number(r.amount ?? 0);
    return acc + (r.is_refund === true ? -Math.abs(amt) : amt);
  }, 0);
  const metrics: RoiMetrics = {
    patientCount,
    active30d,
    retentionRate: patientCount > 0 ? active30d / patientCount : 0,
    engagementActions30d,
    engagementPerPatient30d: patientCount > 0 ? engagementActions30d / patientCount : 0,
    revenue30d,
    valuePerActivePatient30d: active30d > 0 ? revenue30d / active30d : 0,
    appointmentsCompleted30d: appts?.length ?? 0,
  };
  return { metrics, clinicName: String(clinic?.name ?? 'Clinic') };
}

export async function generateAndSendClinicRoiReport(params: {
  clinicId: string;
  generatedByAuthUserId: string;
}): Promise<{ reportId: string | null; reportText: string | null; error: Error | null }> {
  try {
    const { metrics, clinicName } = await computeClinicRoiMetrics(params.clinicId);
    const periodStart = isoDaysAgo(30);
    const periodEnd = isoDaysAgo(0);

    const ai = await anthropicMessages({
      system:
        'You are a clinic operations analyst. Write concise ROI reports with concrete numbers and practical business impact.',
      user: `Create a short ROI report for ${clinicName} using these metrics JSON:\n${JSON.stringify(metrics)}\nReturn 4-6 sentences.`,
      maxTokens: 240,
    });
    const reportText = ai.text?.trim() || fallbackReport(clinicName, metrics);

    const { data: owners } = await supabase
      .from('providers')
      .select('email, first_name, last_name')
      .eq('clinic_id', params.clinicId)
      .eq('is_owner', true);
    const sentTo = (owners ?? []).map((o) => ({
      email: o.email ?? null,
      name: `${o.first_name ?? ''} ${o.last_name ?? ''}`.trim() || null,
    }));

    const { data, error } = await supabase
      .from('clinic_roi_reports')
      .insert({
        clinic_id: params.clinicId,
        generated_by_auth_user_id: params.generatedByAuthUserId,
        period_start: periodStart,
        period_end: periodEnd,
        report_text: reportText,
        metrics_json: metrics,
        sent_at: new Date().toISOString(),
        sent_to: sentTo,
      })
      .select('id')
      .maybeSingle();
    if (error) return { reportId: null, reportText: null, error: new Error(error.message) };
    return { reportId: String(data?.id ?? ''), reportText, error: null };
  } catch (e) {
    return { reportId: null, reportText: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function fetchLatestClinicRoiReports(clinicIds: string[]): Promise<{
  byClinicId: Record<string, { period_end: string; created_at: string } | undefined>;
  error: Error | null;
}> {
  if (clinicIds.length === 0) return { byClinicId: {}, error: null };
  const { data, error } = await supabase
    .from('clinic_roi_reports')
    .select('clinic_id, period_end, created_at')
    .in('clinic_id', clinicIds)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return { byClinicId: {}, error: new Error(error.message) };

  const byClinicId: Record<string, { period_end: string; created_at: string } | undefined> = {};
  for (const row of data ?? []) {
    const cid = String(row.clinic_id ?? '');
    if (!cid || byClinicId[cid]) continue;
    byClinicId[cid] = {
      period_end: String(row.period_end),
      created_at: String(row.created_at),
    };
  }
  return { byClinicId, error: null };
}

export async function listClinicOwnerRoiReports(authUserId: string): Promise<{
  clinicName: string | null;
  rows: Array<{
    id: string;
    period_start: string;
    period_end: string;
    report_text: string;
    created_at: string;
  }>;
  error: Error | null;
}> {
  const { data: provider, error: pErr } = await supabase
    .from('providers')
    .select('clinic_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (pErr || !provider?.clinic_id) return { clinicName: null, rows: [], error: pErr ? new Error(pErr.message) : null };
  const clinicId = String(provider.clinic_id);
  const [{ data: clinic }, { data: rows, error }] = await Promise.all([
    supabase.from('clinics').select('name').eq('id', clinicId).maybeSingle(),
    supabase
      .from('clinic_roi_reports')
      .select('id, period_start, period_end, report_text, created_at')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  if (error) return { clinicName: String(clinic?.name ?? ''), rows: [], error: new Error(error.message) };
  return {
    clinicName: String(clinic?.name ?? ''),
    rows: (rows ?? []).map((r) => ({
      id: String(r.id),
      period_start: String(r.period_start),
      period_end: String(r.period_end),
      report_text: String(r.report_text ?? ''),
      created_at: String(r.created_at),
    })),
    error: null,
  };
}
