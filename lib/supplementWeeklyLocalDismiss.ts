import AsyncStorage from '@react-native-async-storage/async-storage';

const prefix = 'sonalife_supplement_weekly_snooze_';

export async function isSupplementWeeklySnoozed(weekAnchor: string): Promise<boolean> {
  const v = await AsyncStorage.getItem(`${prefix}${weekAnchor}`);
  return v === '1';
}

export async function snoozeSupplementWeeklyPrompt(weekAnchor: string): Promise<void> {
  await AsyncStorage.setItem(`${prefix}${weekAnchor}`, '1');
}
