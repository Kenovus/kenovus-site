import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const LOCAL_CHECKIN_ID = 'sonalife-local-checkin';
const LOCAL_STREAK_ID = 'sonalife-local-streak';
const LOCAL_MY_COACH_ID = 'sonalife-my-coach-nudge';
const LOCAL_SUPPLEMENT_WEEKLY_ID = 'sonalife-supplement-weekly';
const LOCAL_NUTRITION_DINNER_NUDGE_ID = 'sonalife-nutrition-dinner-nudge';
const LOCAL_WEEKLY_COACH_SUMMARY_ID = 'sonalife-weekly-coach-summary';
const LOCAL_WORKOUT_COACH_ID = 'sonalife-workout-coach-nudge';
const LOCAL_SKINCARE_AM_ID = 'sonalife-skincare-am';
const LOCAL_SKINCARE_PM_ID = 'sonalife-skincare-pm';

/** Patient-facing My Coach push / local nudge copy (use for remote payloads too). */
export const MY_COACH_NOTIFICATION_TITLE = 'My Coach';
export const MY_COACH_NOTIFICATION_BODY = 'Your coach has a message for you';

let handlerRegistered = false;
let warnedUnavailable = false;
let notificationsModulePromise: Promise<typeof import('expo-notifications') | null> | null = null;

async function getNotificationsModule(): Promise<typeof import('expo-notifications') | null> {
  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications').catch(() => null);
  }
  const loaded = await notificationsModulePromise;
  if (!loaded && !warnedUnavailable) {
    warnedUnavailable = true;
    console.warn('[notifications] expo-notifications unavailable; skipping notifications setup');
  }
  return loaded;
}

export function registerNotificationForegroundHandler(): void {
  if (handlerRegistered) return;
  handlerRegistered = true;
  void (async () => {
    const Notifications = await getNotificationsModule();
    if (!Notifications) return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  })();
}

async function ensureAndroidDefaultChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function scheduleLocalHabitReminders(): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  for (const id of [
    LOCAL_CHECKIN_ID,
    LOCAL_STREAK_ID,
    LOCAL_MY_COACH_ID,
    LOCAL_SUPPLEMENT_WEEKLY_ID,
    LOCAL_NUTRITION_DINNER_NUDGE_ID,
    LOCAL_WEEKLY_COACH_SUMMARY_ID,
    LOCAL_WORKOUT_COACH_ID,
    LOCAL_SKINCARE_AM_ID,
    LOCAL_SKINCARE_PM_ID,
  ]) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      /* not scheduled */
    }
  }

  await Notifications.scheduleNotificationAsync({
    identifier: LOCAL_CHECKIN_ID,
    content: {
      title: 'Daily check-in',
      body: 'Open SonaLife and log today—consistency moves your vitality score.',
      data: { kind: 'checkin_reminder' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 9, minute: 0 },
  });

  await Notifications.scheduleNotificationAsync({
    identifier: LOCAL_STREAK_ID,
    content: {
      title: 'Keep the streak alive',
      body: 'Finish today’s checklist before the day resets—small wins compound.',
      data: { kind: 'streak_nudge' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 19, minute: 30 },
  });

  await Notifications.scheduleNotificationAsync({
    identifier: LOCAL_MY_COACH_ID,
    content: {
      title: MY_COACH_NOTIFICATION_TITLE,
      body: MY_COACH_NOTIFICATION_BODY,
      data: { kind: 'my_coach_nudge' },
    },
    /** Thursday 15:00 — weekday 1 = Sunday per expo-notifications */
    trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 5, hour: 15, minute: 0 },
  });

  await Notifications.scheduleNotificationAsync({
    identifier: LOCAL_SUPPLEMENT_WEEKLY_ID,
    content: {
      title: 'Weekly supplement check-in',
      body: 'Looking back at your week—open SonaLife to reflect on supplement consistency.',
      data: { kind: 'supplement_weekly' },
    },
    /** Sunday 19:00 local — weekday 1 = Sunday per expo-notifications */
    trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 19, minute: 0 },
  });

  await Notifications.scheduleNotificationAsync({
    identifier: LOCAL_NUTRITION_DINNER_NUDGE_ID,
    content: {
      title: 'Nutrition',
      body: "Don't forget to log dinner — your coach is tracking your progress.",
      data: { kind: 'nutrition_dinner_nudge' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 19, minute: 0 },
  });

  await Notifications.scheduleNotificationAsync({
    identifier: LOCAL_WEEKLY_COACH_SUMMARY_ID,
    content: {
      title: MY_COACH_NOTIFICATION_TITLE,
      body: 'Your weekly training & nutrition summary is ready — open My Coach.',
      data: { kind: 'weekly_coach_summary', href: '/patient/home' },
    },
    /** Monday 08:00 local — weekday 1 = Sunday in expo-notifications */
    trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 2, hour: 8, minute: 0 },
  });

  await Notifications.scheduleNotificationAsync({
    identifier: LOCAL_WORKOUT_COACH_ID,
    content: {
      title: MY_COACH_NOTIFICATION_TITLE,
      body: 'Tell me about your workout today so I can log it for you.',
      data: { kind: 'workout_coach_nudge', href: '/patient/home' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 18, minute: 0 },
  });

  await Notifications.scheduleNotificationAsync({
    identifier: LOCAL_SKINCARE_AM_ID,
    content: {
      title: 'Skincare AM routine',
      body: 'Morning skincare check: cleanser, actives, and SPF.',
      data: { kind: 'skincare_am', href: '/patient/profile/skincare' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 8, minute: 0 },
  });

  await Notifications.scheduleNotificationAsync({
    identifier: LOCAL_SKINCARE_PM_ID,
    content: {
      title: 'Skincare PM routine',
      body: 'Evening skincare check: clean, treat, and protect your barrier.',
      data: { kind: 'skincare_pm', href: '/patient/profile/skincare' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 21, minute: 0 },
  });
}

/**
 * Patient bootstrap: Android channel, notification permission, Expo push token → `patients.notification_token`,
 * and local repeating reminders (9:00 daily check-in, Sunday 19:30 streak nudge, Thursday 15:00 My Coach nudge,
 * Sunday 19:00 supplement weekly, 19:00 daily nutrition dinner nudge, Monday 08:00 weekly coach summary).
 */
export async function bootstrapPatientNotifications(authUserId: string): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  await ensureAndroidDefaultChannel();

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return;

  if (Device.isDevice) {
    try {
      const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
      const projectId =
        extra?.eas?.projectId ?? (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
      const envProject = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
      const tokenRes = await Notifications.getExpoPushTokenAsync(
        projectId || envProject ? { projectId: String(projectId ?? envProject) } : undefined,
      );
      await supabase.from('patients').update({ notification_token: tokenRes.data }).eq('auth_user_id', authUserId);
    } catch (e) {
      console.warn('[notifications] Expo push token unavailable (Simulator / missing EAS project is common)', e);
    }
  }

  try {
    await scheduleLocalHabitReminders();
  } catch (e) {
    console.warn('[notifications] local schedule failed', e);
  }
}
