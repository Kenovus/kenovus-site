import { useEffect } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { supabase } from '@/lib/supabase';

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function useRetentionAutomation() {
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!user) return;
      const patientId = await fetchPatientIdForAuthUser(user.id);
      if (!patientId || cancelled) return;

      const today = new Date();
      const todayIso = today.toISOString().slice(0, 10);
      const prev7 = new Date(today);
      prev7.setDate(prev7.getDate() - 7);
      const prev14 = new Date(today);
      prev14.setDate(prev14.getDate() - 14);
      const prev7Iso = prev7.toISOString().slice(0, 10);
      const prev14Iso = prev14.toISOString().slice(0, 10);

      const [{ data: patient }, { data: weekLogs }, { data: prevWeekLogs }, { data: checklist }] = await Promise.all([
        supabase.from('patients').select('last_active_at').eq('id', patientId).maybeSingle(),
        supabase.from('food_log_entries').select('id').eq('patient_id', patientId).gte('log_date', prev7Iso),
        supabase
          .from('food_log_entries')
          .select('id')
          .eq('patient_id', patientId)
          .gte('log_date', prev14Iso)
          .lt('log_date', prev7Iso),
        supabase
          .from('daily_checklist_items')
          .select('completed, checklist_date')
          .eq('patient_id', patientId)
          .gte('checklist_date', prev14Iso),
      ]);

      const lastOpen = patient?.last_active_at ? new Date(patient.last_active_at).getTime() : Date.now();
      const daysSinceOpen = Math.floor((Date.now() - lastOpen) / (1000 * 60 * 60 * 24));
      const weekCount = (weekLogs ?? []).length;
      const prevWeekCount = (prevWeekLogs ?? []).length;
      const checklistRows = checklist ?? [];
      const done = checklistRows.filter((r) => r.completed === true).length;
      const proteinAdherence = clamp01(weekCount / 14);

      const byDate = new Map<string, { total: number; done: number }>();
      for (const r of checklistRows) {
        const d = String(r.checklist_date);
        const v = byDate.get(d) ?? { total: 0, done: 0 };
        v.total += 1;
        if (r.completed === true) v.done += 1;
        byDate.set(d, v);
      }
      const ordered = [...byDate.entries()].sort((a, b) => (a[0] > b[0] ? -1 : 1));
      let streak = 0;
      for (const [, v] of ordered) {
        const rate = v.total ? v.done / v.total : 0;
        if (rate >= 0.5) streak += 1;
        else break;
      }

      const churnRisk = clamp01(
        0.25 * (daysSinceOpen / 7) +
          0.3 * (weekCount < Math.max(2, prevWeekCount) ? 1 : 0) +
          0.2 * (proteinAdherence < 0.5 ? 1 : 0) +
          0.25 * (streak < 2 ? 1 : 0),
      );

      await supabase.from('patient_behavior_snapshots').upsert(
        {
          patient_id: patientId,
          snapshot_date: todayIso,
          days_since_last_open: daysSinceOpen,
          week_log_count: weekCount,
          prev_week_log_count: prevWeekCount,
          protein_7day_adherence: proteinAdherence,
          current_streak: streak,
          app_opens_7day: Math.max(1, 7 - Math.max(0, daysSinceOpen - 1)),
          churn_risk_score: churnRisk,
        },
        { onConflict: 'patient_id,snapshot_date' },
      );

      if (churnRisk >= 0.7) {
        await supabase.from('engagement_events').insert({
          patient_id: patientId,
          event_type: 'retention_nudge',
          signal_type: 'churn_risk_high',
          message_sent:
            'You are one small action away from momentum. Start with your first checklist item right now.',
          opened_at: new Date().toISOString(),
        });
      } else if (streak > 0 && streak % 7 === 0) {
        await supabase.from('engagement_events').insert({
          patient_id: patientId,
          event_type: 'milestone',
          signal_type: `streak_${streak}`,
          message_sent: `Streak milestone: ${streak} days. Keep the floor high, not perfect.`,
          opened_at: new Date().toISOString(),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);
}
