import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { supabase } from '@/lib/supabase';

const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(len = 8): string {
  let out = '';
  for (let i = 0; i < len; i += 1) {
    const idx = Math.floor(Math.random() * REFERRAL_CODE_ALPHABET.length);
    out += REFERRAL_CODE_ALPHABET[idx];
  }
  return out;
}

export async function getOrCreateReferralCode(authUserId: string): Promise<{ code: string | null; error: Error | null }> {
  const patientId = await fetchPatientIdForAuthUser(authUserId);
  if (!patientId) return { code: null, error: new Error('Patient profile missing') };

  const { data: existing, error: readErr } = await supabase
    .from('referral_codes')
    .select('code')
    .eq('patient_id', patientId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readErr) return { code: null, error: new Error(readErr.message) };
  if (existing?.code) return { code: String(existing.code), error: null };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = randomCode(8);
    const { error } = await supabase.from('referral_codes').insert({
      patient_id: patientId,
      code,
      is_active: true,
    });
    if (!error) return { code, error: null };
    if (!error.message.toLowerCase().includes('duplicate')) return { code: null, error: new Error(error.message) };
  }

  return { code: null, error: new Error('Could not generate referral code. Try again.') };
}

export async function applyReferralCodeAtOnboarding(
  authUserId: string,
  referralCodeInput: string,
): Promise<{ ok: boolean; message: string }> {
  const code = referralCodeInput.trim().toUpperCase();
  if (!code) return { ok: false, message: 'Code required' };

  const patientId = await fetchPatientIdForAuthUser(authUserId);
  if (!patientId) return { ok: false, message: 'Patient profile missing' };

  const { data: codeRow, error: codeErr } = await supabase
    .from('referral_codes')
    .select('patient_id, clinic_id, code, is_active')
    .eq('code', code)
    .maybeSingle();
  if (codeErr || !codeRow || codeRow.is_active !== true) {
    return { ok: false, message: 'Referral code not found' };
  }
  const referringPatientId = String(codeRow.patient_id ?? '');
  if (!referringPatientId) return { ok: false, message: 'Referral code invalid' };
  if (referringPatientId === patientId) return { ok: false, message: 'You cannot use your own code' };

  const now = new Date().toISOString();
  const { error: upErr } = await supabase.from('referrals').upsert(
    {
      clinic_id: codeRow.clinic_id ?? null,
      referring_patient_id: referringPatientId,
      referred_patient_id: patientId,
      referral_code: code,
      status: 'registered',
      registered_at: now,
      downloaded_at: now,
      clicked_at: now,
    },
    { onConflict: 'referred_patient_id' },
  );
  if (upErr) return { ok: false, message: upErr.message };

  try {
    await supabase.rpc('increment_referral_code_totals', { p_code: code });
  } catch {
    /* non-blocking aggregate update */
  }

  return { ok: true, message: 'Referral applied' };
}

export async function getPatientReferralSummary(authUserId: string): Promise<{
  code: string | null;
  referredByCode: string | null;
  total: number;
  booked: number;
  completed: number;
  pendingPerks: number;
  error: Error | null;
}> {
  const patientId = await fetchPatientIdForAuthUser(authUserId);
  if (!patientId) {
    return { code: null, referredByCode: null, total: 0, booked: 0, completed: 0, pendingPerks: 0, error: null };
  }

  const [{ data: codeRow, error: cErr }, { data: outgoing, error: oErr }, { data: incoming, error: iErr }] =
    await Promise.all([
      supabase
        .from('referral_codes')
        .select('code')
        .eq('patient_id', patientId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('referrals').select('status, perk_issued, perk_redeemed').eq('referring_patient_id', patientId),
      supabase.from('referrals').select('referral_code').eq('referred_patient_id', patientId).maybeSingle(),
    ]);

  if (cErr || oErr || iErr) {
    return {
      code: null,
      referredByCode: null,
      total: 0,
      booked: 0,
      completed: 0,
      pendingPerks: 0,
      error: new Error(cErr?.message ?? oErr?.message ?? iErr?.message ?? 'Could not load referrals'),
    };
  }

  const rows = outgoing ?? [];
  return {
    code: (codeRow?.code as string | undefined) ?? null,
    referredByCode: (incoming?.referral_code as string | undefined) ?? null,
    total: rows.length,
    booked: rows.filter((r) => r.status === 'booked' || r.status === 'completed').length,
    completed: rows.filter((r) => r.status === 'completed').length,
    pendingPerks: rows.filter((r) => r.perk_issued === true && r.perk_redeemed !== true).length,
    error: null,
  };
}

export async function getProviderClinicReferralSummary(authUserId: string): Promise<{
  clinicName: string | null;
  total: number;
  booked: number;
  completed: number;
  pendingPerks: number;
  topCodes: Array<{ code: string; count: number }>;
  error: Error | null;
}> {
  const { data: provider, error: pErr } = await supabase
    .from('providers')
    .select('clinic_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (pErr || !provider?.clinic_id) {
    return {
      clinicName: null,
      total: 0,
      booked: 0,
      completed: 0,
      pendingPerks: 0,
      topCodes: [],
      error: pErr ? new Error(pErr.message) : null,
    };
  }

  const clinicId = String(provider.clinic_id);
  const [{ data: clinic }, { data: rows, error }] = await Promise.all([
    supabase.from('clinics').select('name').eq('id', clinicId).maybeSingle(),
    supabase.from('referrals').select('referral_code, status, perk_issued, perk_redeemed').eq('clinic_id', clinicId),
  ]);
  if (error) {
    return {
      clinicName: (clinic?.name as string | undefined) ?? null,
      total: 0,
      booked: 0,
      completed: 0,
      pendingPerks: 0,
      topCodes: [],
      error: new Error(error.message),
    };
  }

  const counts = new Map<string, number>();
  for (const row of rows ?? []) {
    const code = String(row.referral_code ?? '').trim();
    if (!code) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  const topCodes = [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    clinicName: (clinic?.name as string | undefined) ?? null,
    total: (rows ?? []).length,
    booked: (rows ?? []).filter((r) => r.status === 'booked' || r.status === 'completed').length,
    completed: (rows ?? []).filter((r) => r.status === 'completed').length,
    pendingPerks: (rows ?? []).filter((r) => r.perk_issued === true && r.perk_redeemed !== true).length,
    topCodes,
    error: null,
  };
}
