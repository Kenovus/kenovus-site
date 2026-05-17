/**
 * PART 8 — Referral / Affiliate system.
 * Brody Kennedy: code BRODY, 20% month-one commission, lifetime GLP-1+ access.
 */
import { supabase } from '@/lib/supabase';

export interface ReferralStats {
  referralCode: string;
  totalClicks: number;
  totalConversions: number;
  totalCommissionEarned: number;
  unpaidCommission: number;
  conversions: ConversionRow[];
}

interface ConversionRow {
  referred_user_id: string;
  conversion_date: string;
  commission_amount: number;
  paid: boolean;
}

/** Create or fetch referral record for a user */
export async function upsertReferral(userId: string, code: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('referrals').upsert(
    { referrer_id: userId, referral_code: code.toUpperCase() },
    { onConflict: 'referral_code' },
  );
  return { error: error?.message ?? null };
}

/** Look up referrer by code and record a new referral click/conversion */
export async function recordReferral(
  referralCode: string,
  referredUserId: string,
  subscriptionAmount: number,
): Promise<{ error: string | null }> {
  const { data: ref } = await supabase
    .from('referrals')
    .select('id, referrer_id')
    .eq('referral_code', referralCode.toUpperCase())
    .single();

  if (!ref) return { error: 'Referral code not found' };

  const commission = subscriptionAmount * 0.20; // 20% month-one

  const { error } = await supabase.from('referrals').update({
    referred_user_id: referredUserId,
    conversion_date: new Date().toISOString(),
    commission_amount: commission,
    paid: false,
  }).eq('id', ref.id);

  return { error: error?.message ?? null };
}

/** Fetch referral stats for a user */
export async function fetchReferralStats(userId: string): Promise<ReferralStats | null> {
  const { data } = await supabase
    .from('referrals')
    .select('*')
    .eq('referrer_id', userId);

  if (!data || data.length === 0) return null;

  const conversions = data
    .filter((r) => r.conversion_date)
    .map((r) => ({
      referred_user_id: r.referred_user_id,
      conversion_date: r.conversion_date,
      commission_amount: r.commission_amount ?? 0,
      paid: r.paid ?? false,
    }));

  const totalCommission = conversions.reduce((s, c) => s + c.commission_amount, 0);
  const unpaid = conversions.filter((c) => !c.paid).reduce((s, c) => s + c.commission_amount, 0);

  return {
    referralCode: data[0].referral_code,
    totalClicks: data.length,
    totalConversions: conversions.length,
    totalCommissionEarned: totalCommission,
    unpaidCommission: unpaid,
    conversions,
  };
}

// Brody's specific setup — run once to seed
export const BRODY_SETUP_SQL = `
-- Brody gets lifetime GLP-1+ via RevenueCat entitlement (set in RC dashboard)
-- Seed his referral record (replace <brody_user_id> with actual UUID after he signs up):
-- INSERT INTO referrals (referrer_id, referral_code, notes)
-- VALUES ('<brody_user_id>', 'BRODY', 'Lifetime GLP-1+ access granted via RevenueCat')
-- ON CONFLICT (referral_code) DO NOTHING;
`;
