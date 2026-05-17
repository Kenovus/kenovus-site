/**
 * Daily Wins — persists Win the Day checkbox state to Supabase.
 * Also updates patient_streaks when all three goals are hit.
 *
 * SQL to run once in Supabase dashboard:
 *
 * CREATE TABLE IF NOT EXISTS daily_wins (
 *   id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   patient_id   UUID NOT NULL,
 *   win_date     DATE NOT NULL DEFAULT CURRENT_DATE,
 *   protein_hit  BOOLEAN NOT NULL DEFAULT FALSE,
 *   training_done BOOLEAN NOT NULL DEFAULT FALSE,
 *   steps_hit    BOOLEAN NOT NULL DEFAULT FALSE,
 *   all_three    BOOLEAN NOT NULL DEFAULT FALSE,
 *   created_at   TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at   TIMESTAMPTZ DEFAULT NOW(),
 *   UNIQUE (patient_id, win_date)
 * );
 *
 * CREATE TABLE IF NOT EXISTS patient_streaks (
 *   id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   patient_id     UUID NOT NULL UNIQUE,
 *   current_streak INTEGER NOT NULL DEFAULT 0,
 *   longest_streak INTEGER NOT NULL DEFAULT 0,
 *   last_win_date  DATE,
 *   updated_at     TIMESTAMPTZ DEFAULT NOW()
 * );
 */
import { supabase } from '@/lib/supabase';

export interface DailyWinState {
  protein_hit:   boolean;
  training_done: boolean;
  steps_hit:     boolean;
  all_three:     boolean;
}

export interface StreakInfo {
  current_streak: number;
  longest_streak: number;
  last_win_date:  string | null;
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function fetchDailyWins(
  patientId: string,
  date: string,
): Promise<DailyWinState> {
  const { data } = await supabase
    .from('daily_wins')
    .select('protein_hit, training_done, steps_hit, all_three')
    .eq('patient_id', patientId)
    .eq('win_date', date)
    .maybeSingle();

  return {
    protein_hit:   data?.protein_hit   ?? false,
    training_done: data?.training_done ?? false,
    steps_hit:     data?.steps_hit     ?? false,
    all_three:     data?.all_three     ?? false,
  };
}

export async function fetchStreakInfo(patientId: string): Promise<StreakInfo> {
  const { data } = await supabase
    .from('patient_streaks')
    .select('current_streak, longest_streak, last_win_date')
    .eq('patient_id', patientId)
    .maybeSingle();

  return {
    current_streak: data?.current_streak ?? 0,
    longest_streak: data?.longest_streak ?? 0,
    last_win_date:  data?.last_win_date  ?? null,
  };
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function upsertDailyWins(
  patientId: string,
  date: string,
  wins: Omit<DailyWinState, 'all_three'>,
): Promise<void> {
  const all_three = wins.protein_hit && wins.training_done && wins.steps_hit;

  await supabase
    .from('daily_wins')
    .upsert(
      {
        patient_id: patientId,
        win_date:   date,
        ...wins,
        all_three,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'patient_id,win_date' },
    );

  // Update streak when all three are hit for the first time today
  if (all_three) {
    await _updateStreak(patientId, date);
  }
}

async function _updateStreak(patientId: string, date: string): Promise<void> {
  const { data: existing } = await supabase
    .from('patient_streaks')
    .select('current_streak, longest_streak, last_win_date')
    .eq('patient_id', patientId)
    .maybeSingle();

  const yesterday = _daysAgo(1);
  const lastWin   = existing?.last_win_date ?? null;

  // If already recorded today, skip
  if (lastWin === date) return;

  const continued   = lastWin === yesterday;
  const newCurrent  = continued ? (existing?.current_streak ?? 0) + 1 : 1;
  const newLongest  = Math.max(existing?.longest_streak ?? 0, newCurrent);

  await supabase
    .from('patient_streaks')
    .upsert(
      {
        patient_id:     patientId,
        current_streak: newCurrent,
        longest_streak: newLongest,
        last_win_date:  date,
        updated_at:     new Date().toISOString(),
      },
      { onConflict: 'patient_id' },
    );
}

function _daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ── Milestone messaging ───────────────────────────────────────────────────────

export function streakMilestoneMessage(streak: number): string | null {
  if (streak === 7)  return "7-day streak — you're building a habit now.";
  if (streak === 14) return "14 days strong. Two weeks of consistency.";
  if (streak === 30) return "30 days. A month of winning. This is who you are now.";
  if (streak === 60) return "60 days. You've built a lifestyle, not a phase.";
  if (streak === 90) return "90 days. Three months straight. Transformation complete.";
  return null;
}

export function streakIdentityLine(streak: number): string {
  if (streak >= 30) return "You're a person who shows up every single day.";
  if (streak >= 14) return "You're building consistency — this is how transformation works.";
  if (streak >= 7)  return "You've got momentum. Don't let up now.";
  if (streak >= 3)  return "Three days in. The habit is forming.";
  return "Every day counts. Keep going.";
}
