import { toPounds, type WeightLogRow } from '@/lib/weightLogs';

/** Latest calendar-day weight in lbs (most recent log that day if multiple). */
export function latestWeightLbsByDate(rows: WeightLogRow[]): Map<string, number> {
  const byDate = new Map<string, { lbs: number; at: number }>();
  for (const r of rows) {
    const lbs = toPounds(r.weight_value, r.unit);
    const at = new Date(r.logged_at).getTime();
    const prev = byDate.get(r.log_date);
    if (!prev || at >= prev.at) {
      byDate.set(r.log_date, { lbs, at });
    }
  }
  const out = new Map<string, number>();
  for (const [d, v] of byDate) out.set(d, v.lbs);
  return out;
}

/** Mean lbs over the last `days` calendar days that have at least one weigh-in (rolling window from `anchorDate` YYYY-MM-DD). */
export function rollingMeanWeightLbs(
  rows: WeightLogRow[],
  days: number,
  anchorDate = new Date(),
): number | null {
  if (rows.length === 0 || days < 1) return null;
  const byDay = latestWeightLbsByDate(rows);
  const values: number[] = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const key = `${y}-${m}-${day}`;
    const v = byDay.get(key);
    if (v != null) values.push(v);
  }
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
