/**
 * PART 8 — Appointment awareness in Sona.
 * Proactive appointment references injected into Sona's context.
 */
import { fetchUpcomingAppointments, fetchTreatmentHistory } from '@/lib/patientTreatments';
import { SIMI_PROTOCOLS } from '@/lib/simiClinicalProtocols';

export async function buildAppointmentAwarenessBlock(patientId: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const todayMs = Date.now();

  const [upcoming, recent] = await Promise.all([
    fetchUpcomingAppointments(patientId),
    fetchTreatmentHistory(patientId, 5),
  ]);

  const lines: string[] = [];

  // Upcoming appointments within 14 days
  if (upcoming.length > 0) {
    lines.push('── UPCOMING APPOINTMENTS ──');
    for (const appt of upcoming) {
      const apptDate = new Date(`${appt.appointment_date}T12:00:00`);
      const daysUntil = Math.ceil((apptDate.getTime() - todayMs) / 86400000);
      const dayLabel = daysUntil === 0 ? 'TODAY' : daysUntil === 1 ? 'TOMORROW' : `in ${daysUntil} days`;
      lines.push(`• ${appt.treatment_name} ${dayLabel}${appt.provider ? ` with ${appt.provider}` : ''} (${appt.appointment_date})`);
    }
  }

  // Recent treatments with recovery context
  if (recent.length > 0) {
    lines.push('── RECENT TREATMENTS ──');
    for (const t of recent) {
      const daysAgo = Math.floor((todayMs - new Date(`${t.treatment_date}T12:00:00`).getTime()) / 86400000);
      const postCareKey = getPostCareKey(t.treatment_name);
      const postCare = postCareKey ? SIMI_PROTOCOLS.postCareProtocols[postCareKey] : null;
      let recoveryNote = '';
      if (postCare && daysAgo <= 14) {
        if (daysAgo === 1 && postCare.day1)  recoveryNote = ` [Day 1 protocol: ${postCare.day1.slice(0, 60)}...]`;
        if (daysAgo === 3 && postCare.day3)  recoveryNote = ` [Day 3 note: ${postCare.day3.slice(0, 60)}...]`;
        if (daysAgo === 7 && postCare.day7)  recoveryNote = ` [Day 7 note: ${postCare.day7.slice(0, 60)}...]`;
        if (daysAgo === 14 && 'day14' in postCare) recoveryNote = ` [Day 14: ${String((postCare as unknown as Record<string, unknown>).day14 ?? '').slice(0, 60)}...]`;
      }
      lines.push(`• ${t.treatment_name} — ${daysAgo} days ago${recoveryNote}`);
    }
  }

  // Series reminder: suggest rebooking for series treatments
  for (const t of recent) {
    const daysAgo = Math.floor((todayMs - new Date(`${t.treatment_date}T12:00:00`).getTime()) / 86400000);
    if (isSeriesTreatment(t.treatment_name) && daysAgo >= 28 && daysAgo <= 45) {
      lines.push(`💡 Series reminder: It's been ${daysAgo} days since ${t.treatment_name} — now may be the right time for your next in the series.`);
    }
  }

  // Lab due reminder for GLP-1 (every 90 days)
  // (Would need GLP-1 start date from patient record — simplified here)
  lines.push('📋 Labs reminder: Simi recommends labs every 3 months on GLP-1 — HbA1c, CMP, CBC, lipid panel.');

  return lines.length ? lines.join('\n') : '';
}

function getPostCareKey(treatmentName: string): keyof typeof SIMI_PROTOCOLS.postCareProtocols | null {
  const lower = treatmentName.toLowerCase();
  if (lower.includes('botox') || lower.includes('daxxify') || lower.includes('dysport')) return 'botox_daxxify';
  if (lower.includes('filler') || lower.includes('radiesse')) return 'filler_radiesse';
  if (lower.includes('ipl') || lower.includes('laser') || lower.includes('pico')) return 'laser_ipl';
  if (lower.includes('microneedling') || lower.includes('skinpen') || lower.includes('rf')) return 'microneedling';
  if (lower.includes('co2') || lower.includes('resurfacing')) return 'co2_laser';
  return null;
}

function isSeriesTreatment(name: string): boolean {
  const lower = name.toLowerCase();
  return ['microneedling', 'ipl', 'laser', 'chemical peel', 'hydrafacial', 'co2'].some((t) => lower.includes(t));
}

/** Proactive appointment messages Sona can surface unprompted */
export function generateProactiveAppointmentMessage(
  upcoming: { treatment_name: string; appointment_date: string; provider?: string | null }[],
  recent: { treatment_name: string; treatment_date: string }[],
): string | null {
  if (!upcoming.length && !recent.length) return null;

  const todayMs = Date.now();

  // Within 3 days of appointment
  for (const appt of upcoming) {
    const daysUntil = Math.ceil(
      (new Date(`${appt.appointment_date}T12:00:00`).getTime() - todayMs) / 86400000,
    );
    if (daysUntil <= 3 && daysUntil >= 0) {
      const when = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;
      return `You have a ${appt.treatment_name} appointment ${when}${appt.provider ? ` with ${appt.provider}` : ''}. Anything you'd like to discuss or prepare beforehand?`;
    }
  }

  // Series rebooking nudge
  for (const t of recent) {
    const daysAgo = Math.floor(
      (todayMs - new Date(`${t.treatment_date}T12:00:00`).getTime()) / 86400000,
    );
    if (isSeriesTreatment(t.treatment_name) && daysAgo >= 35 && daysAgo <= 42) {
      return `It's been ${daysAgo} days since your ${t.treatment_name}. Ready to book your next session in the series?`;
    }
  }

  return null;
}
