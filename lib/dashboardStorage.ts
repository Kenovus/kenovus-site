import AsyncStorage from '@react-native-async-storage/async-storage';

const GREETING_DATE_KEY = 'sonalife_patient_dashboard_greeting_date';

/** Local calendar date YYYY-MM-DD (device timezone). */
export function localDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function getLastDashboardGreetingDate(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(GREETING_DATE_KEY);
  } catch {
    return null;
  }
}

export async function setLastDashboardGreetingDate(date: string): Promise<void> {
  try {
    await AsyncStorage.setItem(GREETING_DATE_KEY, date);
  } catch {
    /* ignore */
  }
}

/** Clears stored date so the next dashboard load runs the “first open of day” greeting flow. */
export async function clearLastDashboardGreetingDate(): Promise<void> {
  try {
    await AsyncStorage.removeItem(GREETING_DATE_KEY);
  } catch {
    /* ignore */
  }
}

export function shouldShowDailyGreeting(lastStored: string | null): boolean {
  const today = localDateKey();
  return lastStored !== today;
}

/** When `EXPO_PUBLIC_FORCE_DAILY_GREETING=1` in `.env`, always show the greeting (for UI testing). */
export function isForceDailyGreetingEnabled(): boolean {
  return (
    typeof process !== 'undefined' &&
    String(process.env.EXPO_PUBLIC_FORCE_DAILY_GREETING ?? '').trim() === '1'
  );
}
