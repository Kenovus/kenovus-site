/**
 * Pure projection engine for the Physique Forecast calendar.
 *
 * No Supabase imports — the screen fetches actuals and hands them in.
 * Linear interpolation start → goal, with confidence adjusted by actual
 * weight delta and behavior signals.
 */

export interface PhysiqueGoal {
  startDate: string;        // ISO YYYY-MM-DD
  goalDate: string;         // ISO YYYY-MM-DD
  startWeight: number;      // lbs
  goalWeight: number;       // lbs
  startBodyFat: number;     // %
  goalBodyFat: number;      // %
  dailyCalories: number;    // kcal
  dailyProtein: number;     // g
}

export type DayStatus = 'won' | 'missed' | 'partial' | 'no_data' | 'today' | 'future';

export interface DayProjection {
  date: string;
  projectedWeight: number;
  projectedBodyFat: number;
  projectedLeanMass: number;
  dayNumber: number;
  daysRemaining: number;
  confidenceScore: number;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  status: DayStatus;
  isInBodyDay: boolean;
  isMilestone: boolean;
  milestoneText?: string;
  isGoalDay: boolean;
  actualWeight?: number;
  actualBodyFat?: number;
}

export interface ActualDataPoint {
  date: string;              // ISO YYYY-MM-DD
  weight?: number;           // lbs
  bodyFat?: number;          // %
  proteinHit?: boolean;
  trainingDone?: boolean;
  stepsHit?: boolean;
  hasAnyLog?: boolean;       // any signal at all for the day
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function parseISODate(iso: string): Date {
  // Avoid TZ shift — parse as local midnight
  const [y, m, d] = iso.split('-').map((s) => parseInt(s, 10));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86_400_000);
}

export function todayISO(): string {
  return isoDate(new Date());
}

/** Lean mass from weight + body fat. */
export function leanMass(weight: number, bodyFatPct: number): number {
  return weight * (1 - bodyFatPct / 100);
}

/**
 * Generate per-day projections from start through goal.
 * Returns at least 1 day. Caps at 730 days (2y) defensively.
 */
export function generateProjections(
  goal: PhysiqueGoal,
  actuals: ActualDataPoint[] = [],
): DayProjection[] {
  const start = parseISODate(goal.startDate);
  const end = parseISODate(goal.goalDate);
  const today = parseISODate(todayISO());

  const totalDays = Math.max(1, daysBetween(start, end));
  const cap = Math.min(totalDays, 730);

  const weightRatePerDay = (goal.startWeight - goal.goalWeight) / totalDays;
  const bfRatePerDay = (goal.startBodyFat - goal.goalBodyFat) / totalDays;

  const actualsByDate = new Map<string, ActualDataPoint>();
  for (const a of actuals) actualsByDate.set(a.date, a);

  // Confidence is computed as we walk forward so it stays bounded.
  let confidence = 85;
  let lastBfWholeShown = Math.floor(goal.startBodyFat);

  const out: DayProjection[] = [];
  for (let i = 0; i <= cap; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const iso = isoDate(date);

    const projectedWeight = goal.startWeight - weightRatePerDay * i;
    const projectedBodyFat = Math.max(0, goal.startBodyFat - bfRatePerDay * i);
    const projectedLean = leanMass(projectedWeight, projectedBodyFat);

    const isToday = iso === isoDate(today);
    const isPast = date.getTime() < today.getTime() && !isToday;
    const isFuture = date.getTime() > today.getTime();

    const actual = actualsByDate.get(iso);

    // Confidence: adjust based on past signals only.
    if (isPast && actual) {
      if (actual.proteinHit) confidence += 1;
      if (actual.proteinHit === false) confidence -= 2;
      if (typeof actual.weight === 'number') {
        const aheadOfPace = actual.weight <= projectedWeight + 0.25;
        confidence += aheadOfPace ? 1 : -1;
      }
      confidence = Math.max(0, Math.min(100, confidence));
    }

    let status: DayStatus;
    if (isToday) status = 'today';
    else if (isFuture) status = 'future';
    else {
      const hits = [actual?.proteinHit, actual?.trainingDone, actual?.stepsHit].filter(Boolean).length;
      const anyLog = actual?.hasAnyLog || actual?.proteinHit || actual?.trainingDone || actual?.stepsHit || typeof actual?.weight === 'number';
      if (hits === 3) status = 'won';
      else if (hits >= 1) status = 'partial';
      else if (anyLog) status = 'partial';
      else if (!actual) status = 'no_data';
      else status = 'missed';
    }

    const dayNumber = i + 1;
    const daysRemaining = Math.max(0, totalDays - i);
    const isInBodyDay = i > 0 && i % 28 === 0;
    const isGoalDay = iso === goal.goalDate;

    // Milestone: when projected BF crosses to a new whole number lower than the last shown.
    const currentBfWhole = Math.floor(projectedBodyFat);
    let milestoneText: string | undefined;
    let isMilestone = false;
    if (currentBfWhole < lastBfWholeShown) {
      isMilestone = true;
      milestoneText = `${currentBfWhole}% Body Fat`;
      lastBfWholeShown = currentBfWhole;
    } else if (Math.abs(projectedWeight - Math.round(projectedWeight)) < 0.05 && Math.round(projectedWeight) % 5 === 0) {
      // Also flag every 5-lb landmark — but don't overwrite a BF milestone
      isMilestone = isMilestone || true;
      milestoneText = milestoneText ?? `${Math.round(projectedWeight)} lbs reached`;
    }

    out.push({
      date: iso,
      projectedWeight: Math.round(projectedWeight * 10) / 10,
      projectedBodyFat: Math.round(projectedBodyFat * 10) / 10,
      projectedLeanMass: Math.round(projectedLean * 10) / 10,
      dayNumber,
      daysRemaining,
      confidenceScore: Math.round(confidence),
      isToday,
      isPast,
      isFuture,
      status,
      isInBodyDay,
      isMilestone,
      milestoneText,
      isGoalDay,
      actualWeight: actual?.weight,
      actualBodyFat: actual?.bodyFat,
    });
  }
  return out;
}

/** Current confidence (last past or today projection). */
export function currentConfidence(days: DayProjection[]): number {
  if (days.length === 0) return 0;
  const cutoffIdx = days.findIndex((d) => d.isToday);
  const idx = cutoffIdx >= 0 ? cutoffIdx : days.length - 1;
  return days[idx]?.confidenceScore ?? 85;
}

export function confidenceLabel(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= 75) return 'High';
  if (score >= 50) return 'Medium';
  return 'Low';
}

/** ISO date keys for the Mon–Sun week containing `dateISO`. */
export function weekDates(dateISO: string): string[] {
  const d = parseISODate(dateISO);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    return isoDate(dt);
  });
}

/** ISO date keys for the calendar grid containing the given month (sun-start grid). */
export function monthGridDates(year: number, month0: number): string[] {
  const first = new Date(year, month0, 1);
  const firstDow = first.getDay(); // 0 = Sun
  const start = new Date(first);
  start.setDate(first.getDate() - firstDow);
  return Array.from({ length: 42 }, (_, i) => {
    const dt = new Date(start);
    dt.setDate(start.getDate() + i);
    return isoDate(dt);
  });
}

export function formatGoalDateShort(iso: string): string {
  const d = parseISODate(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatGoalDateLong(iso: string): string {
  const d = parseISODate(iso);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}
