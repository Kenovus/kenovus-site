import { supabase } from '@/lib/supabase';

type MaybeNum = number | null | undefined;

function safeNum(v: MaybeNum): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function pct(delta: number, base: number): string {
  if (base <= 0) return '0.0%';
  return `${((delta / base) * 100).toFixed(1)}%`;
}

export type SuperAdminOverview = {
  totalMrr: number;
  activeClinics: number;
  activePatients: number;
  avgRevenuePerClinic: number;
  apiCallsToday: number;
  liveSessions: number;
  storageUsedLabel: string;
  errorRate: number;
  alerts: string[];
};

export async function fetchSuperAdminOverview(): Promise<{ data: SuperAdminOverview | null; error: Error | null }> {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const prevMonthStart = new Date(monthStart);
  prevMonthStart.setUTCMonth(prevMonthStart.getUTCMonth() - 1);

  const [
    { count: clinicsCount, error: clinicsErr },
    { count: patientsCount, error: patientsErr },
    { count: activePatients7d, error: activeErr },
    { count: convToday, error: convErr },
    { count: msgToday, error: msgErr },
    { count: flaggedToday, error: flaggedErr },
    { data: txThisMonth, error: txErr },
    { data: txPrevMonth, error: prevTxErr },
  ] = await Promise.all([
    supabase.from('clinics').select('id', { head: true, count: 'exact' }).or('is_active.eq.true,is_active.is.null'),
    supabase.from('patients').select('id', { head: true, count: 'exact' }).eq('is_active', true),
    supabase
      .from('patients')
      .select('id', { head: true, count: 'exact' })
      .gte('last_active_at', new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString()),
    supabase.from('ai_conversations').select('id', { head: true, count: 'exact' }).gte('last_message_at', `${today}T00:00:00.000Z`),
    supabase.from('ai_messages').select('id', { head: true, count: 'exact' }).gte('created_at', `${today}T00:00:00.000Z`),
    supabase
      .from('ai_messages')
      .select('id', { head: true, count: 'exact' })
      .eq('flagged', true)
      .gte('created_at', `${today}T00:00:00.000Z`),
    supabase
      .from('financial_transactions')
      .select('amount, is_refund')
      .gte('transaction_date', monthStart.toISOString().slice(0, 10)),
    supabase
      .from('financial_transactions')
      .select('amount, is_refund')
      .gte('transaction_date', prevMonthStart.toISOString().slice(0, 10))
      .lt('transaction_date', monthStart.toISOString().slice(0, 10)),
  ]);

  const firstErr = clinicsErr ?? patientsErr ?? activeErr ?? convErr ?? msgErr ?? flaggedErr ?? txErr ?? prevTxErr;
  if (firstErr) return { data: null, error: new Error(firstErr.message) };

  const mrr = (txThisMonth ?? []).reduce((acc, r) => {
    const amount = safeNum(r.amount as MaybeNum);
    return acc + (r.is_refund === true ? -Math.abs(amount) : amount);
  }, 0);
  const prevMrr = (txPrevMonth ?? []).reduce((acc, r) => {
    const amount = safeNum(r.amount as MaybeNum);
    return acc + (r.is_refund === true ? -Math.abs(amount) : amount);
  }, 0);
  const mrrDelta = mrr - prevMrr;

  const flagged = flaggedToday ?? 0;
  const totalMsgs = msgToday ?? 0;
  const errorRate = totalMsgs > 0 ? flagged / totalMsgs : 0;

  const alerts: string[] = [];
  if (errorRate >= 0.03) alerts.push(`AI flagged rate elevated at ${(errorRate * 100).toFixed(1)}% today.`);
  if ((activePatients7d ?? 0) < ((patientsCount ?? 0) * 0.3)) alerts.push('Weekly patient activity is below 30% of total active patients.');
  if (mrrDelta < 0) alerts.push(`MRR is down ${pct(Math.abs(mrrDelta), Math.max(prevMrr, 1))} vs last month.`);
  if (alerts.length === 0) alerts.push('No critical alerts right now.');

  return {
    data: {
      totalMrr: mrr,
      activeClinics: clinicsCount ?? 0,
      activePatients: patientsCount ?? 0,
      avgRevenuePerClinic: (clinicsCount ?? 0) > 0 ? mrr / (clinicsCount ?? 1) : 0,
      apiCallsToday: convToday ?? 0,
      liveSessions: activePatients7d ?? 0,
      storageUsedLabel: 'via Supabase dashboard',
      errorRate,
      alerts,
    },
    error: null,
  };
}

export type ClinicDirectoryRow = {
  id: string;
  name: string;
  patients: number;
  mrr: number;
  engagementRate: number;
};

export async function fetchClinicDirectory(): Promise<{ rows: ClinicDirectoryRow[]; error: Error | null }> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [{ data: clinics, error: cErr }, { data: patients, error: pErr }, { data: tx, error: tErr }] = await Promise.all([
    supabase.from('clinics').select('id, name, is_active').or('is_active.eq.true,is_active.is.null').order('name', { ascending: true }),
    supabase.from('patients').select('id, clinic_id, last_active_at').eq('is_active', true),
    supabase.from('financial_transactions').select('clinic_id, amount, is_refund').gte('transaction_date', monthStart.toISOString().slice(0, 10)),
  ]);
  const firstErr = cErr ?? pErr ?? tErr;
  if (firstErr) return { rows: [], error: new Error(firstErr.message) };

  const byClinicPatients = new Map<string, { total: number; active7d: number }>();
  for (const p of patients ?? []) {
    const cid = String(p.clinic_id ?? '');
    if (!cid) continue;
    const curr = byClinicPatients.get(cid) ?? { total: 0, active7d: 0 };
    curr.total += 1;
    if (p.last_active_at && new Date(String(p.last_active_at)).getTime() >= Date.now() - 1000 * 60 * 60 * 24 * 7) {
      curr.active7d += 1;
    }
    byClinicPatients.set(cid, curr);
  }

  const byClinicMrr = new Map<string, number>();
  for (const row of tx ?? []) {
    const cid = String(row.clinic_id ?? '');
    if (!cid) continue;
    const amount = safeNum(row.amount as MaybeNum);
    const signed = row.is_refund === true ? -Math.abs(amount) : amount;
    byClinicMrr.set(cid, (byClinicMrr.get(cid) ?? 0) + signed);
  }

  const rows = (clinics ?? []).map((c) => {
    const p = byClinicPatients.get(String(c.id)) ?? { total: 0, active7d: 0 };
    const mrr = byClinicMrr.get(String(c.id)) ?? 0;
    return {
      id: String(c.id),
      name: String(c.name ?? 'Clinic'),
      patients: p.total,
      mrr,
      engagementRate: p.total > 0 ? p.active7d / p.total : 0,
    };
  });
  return { rows, error: null };
}
