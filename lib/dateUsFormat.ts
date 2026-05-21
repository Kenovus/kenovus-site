/** Digits only → auto MM-DD-YYYY (max 8 digits → MMDDYYYY) */
export function formatDigitsToMmDdYyyy(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4)}`;
}

const MM_DD_YYYY = /^(\d{2})-(\d{2})-(\d{4})$/;

export function parseMmDdYyyyToIso(display: string): string | null {
  const t = display.trim();
  const m = MM_DD_YYYY.exec(t);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export function isoYmdToMmDdYyyy(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return '';
  return `${m[2]}-${m[3]}-${m[1]}`;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'] as const;
const MONTH_SHORT  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;

/** Format a Date or ISO string → "May 21, 2026" (full) or "May 21" (short). */
export function formatDisplayDate(date: Date | string, style: 'full' | 'short' = 'full'): string {
  const d = typeof date === 'string'
    ? new Date(date.includes('T') ? date : `${date}T12:00:00`)
    : date;
  if (isNaN(d.getTime())) return '';
  const month = style === 'short' ? MONTH_SHORT[d.getMonth()] : MONTH_NAMES[d.getMonth()];
  return style === 'short'
    ? `${month} ${d.getDate()}`
    : `${month} ${d.getDate()}, ${d.getFullYear()}`;
}
