/**
 * PART 5 — Push Notification Scheduler
 * Local notifications via expo-notifications.
 * Server-side scheduling via Supabase Edge Functions (scheduled_notifications table).
 */
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';

// ── Permission setup ──────────────────────────────────────────────────────────
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function getExpoPushToken(): Promise<string | null> {
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    });
    return data;
  } catch {
    return null;
  }
}

export async function savePushToken(patientId: string, token: string): Promise<void> {
  await supabase
    .from('patients')
    .update({ expo_push_token: token } as Record<string, unknown>)
    .eq('id', patientId);
}

// ── Local notification helpers ────────────────────────────────────────────────
async function scheduleLocal(opts: {
  title: string;
  body: string;
  triggerMs: number;  // ms from now
  data?: Record<string, unknown>;
}): Promise<string | null> {
  if (opts.triggerMs <= 0) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title: opts.title, body: opts.body, data: opts.data ?? {} },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.round(opts.triggerMs / 1000) },
  });
}

// ── Post-treatment check-in reminders (24/48/72 hr) ─────────────────────────
export async function scheduleCheckinNotifications(
  patientId: string,
  treatmentName: string,
  treatmentDate: string,
): Promise<void> {
  const treatMs = new Date(`${treatmentDate}T12:00:00`).getTime();
  const now = Date.now();

  for (const hours of [24, 48, 72]) {
    const triggerMs = treatMs + hours * 3600000 - now;
    if (triggerMs > 0) {
      await scheduleLocal({
        title: 'Recovery Check-In',
        body: `How are you feeling ${hours} hours after your ${treatmentName}? Tap to log your symptoms.`,
        triggerMs,
        data: { type: 'checkin', patientId, treatmentName, treatmentDate },
      });
    }
  }

  // Also save to DB for server-side cross-device delivery
  await supabase.from('scheduled_notifications').upsert([
    { patient_id: patientId, notification_type: 'checkin_24h', treatment_name: treatmentName, scheduled_for: new Date(treatMs + 24 * 3600000).toISOString(), sent: false },
    { patient_id: patientId, notification_type: 'checkin_48h', treatment_name: treatmentName, scheduled_for: new Date(treatMs + 48 * 3600000).toISOString(), sent: false },
    { patient_id: patientId, notification_type: 'checkin_72h', treatment_name: treatmentName, scheduled_for: new Date(treatMs + 72 * 3600000).toISOString(), sent: false },
  ], { onConflict: 'patient_id,notification_type,treatment_name' });
}

// ── Appointment reminder (24hr before) ───────────────────────────────────────
export async function scheduleAppointmentReminder(
  patientId: string,
  appointmentDate: string,
  treatmentName: string,
  appointmentTime?: string | null,
): Promise<void> {
  const apptMs = new Date(`${appointmentDate}T${appointmentTime ?? '09:00'}:00`).getTime();
  const reminderMs = apptMs - 24 * 3600000;
  const triggerMs = reminderMs - Date.now();

  if (triggerMs > 0) {
    await scheduleLocal({
      title: 'Appointment Tomorrow',
      body: `Reminder: ${treatmentName} at Sona tomorrow${appointmentTime ? ` at ${appointmentTime}` : ''}. Reply to Sona with any questions!`,
      triggerMs,
      data: { type: 'appointment', patientId, treatmentName, appointmentDate },
    });
  }
}

// ── Daily nutrition nudge (if no food logged by 2pm) ─────────────────────────
export async function scheduleDailyNutritionNudge(patientId: string): Promise<void> {
  const now = new Date();
  const target = new Date(now);
  target.setHours(14, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);

  await scheduleLocal({
    title: '🥗 Log your meals',
    body: "You haven't logged any food today. Tell Sona what you've eaten and stay on track!",
    triggerMs: target.getTime() - Date.now(),
    data: { type: 'nutrition_nudge', patientId },
  });
}

// ── Weekly progress summary (Sunday 7pm) ─────────────────────────────────────
export async function scheduleWeeklySummary(patientId: string): Promise<void> {
  const now = new Date();
  const sunday = new Date(now);
  const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
  sunday.setDate(now.getDate() + daysUntilSunday);
  sunday.setHours(19, 0, 0, 0);

  await scheduleLocal({
    title: '📊 Your Weekly Summary',
    body: 'Your Sona weekly progress report is ready. Tap to see how you did this week!',
    triggerMs: sunday.getTime() - Date.now(),
    data: { type: 'weekly_summary', patientId },
  });
}

// ── Provider: flagged check-in alert ─────────────────────────────────────────
export async function sendFlaggedCheckinAlert(
  providerPushToken: string,
  patientName: string,
  treatmentName: string,
  maxSymptom: number,
): Promise<void> {
  // Send via Expo Push API (server-side)
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: providerPushToken,
      title: '⚠️ Review Required',
      body: `${patientName}'s ${treatmentName} check-in flagged — symptom severity ${maxSymptom}/10`,
      data: { type: 'flagged_checkin' },
    }),
  });
}

// ── Proactive Sona message ────────────────────────────────────────────────────
export async function sendProactiveMessage(
  patientId: string,
  message: string,
): Promise<void> {
  const { data: patient } = await supabase
    .from('patients')
    .select('expo_push_token')
    .eq('id', patientId)
    .single();

  const token = (patient as Record<string, unknown> | null)?.expo_push_token as string | null;
  if (!token) return;

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: token,
      title: 'Sona ✦',
      body: message,
      data: { type: 'proactive_sona' },
    }),
  });
}

// ── scheduled_notifications table SQL ─────────────────────────────────────────
export const SCHEDULED_NOTIFICATIONS_SQL = `
CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  treatment_name TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id, notification_type, treatment_name)
);
CREATE INDEX IF NOT EXISTS idx_sched_notifs ON scheduled_notifications(scheduled_for, sent);
`;
