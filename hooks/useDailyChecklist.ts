import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import { canUseGlp1PatientFeatures } from '@/lib/consumerTier';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { localDateKey } from '@/lib/patientSupplements';
import { supabase } from '@/lib/supabase';

type ChecklistItem = {
  id: string;
  taskKey: string;
  taskLabel: string;
  completed: boolean;
  completedAt: string | null;
  scheduledAfter: string | null;
};
const MILESTONES = new Set([7, 14, 30, 60, 90]);

function todayIso(): string {
  return localDateKey();
}

function nowTimeHHmm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function completionSymbol(rate: number): '●' | '◐' | '○' {
  if (rate >= 1) return '●';
  if (rate >= 0.5) return '◐';
  return '○';
}

/** Default daily tasks (task_key stable for analytics). GLP-1 row inserted only when on protocol. */
function buildTodayChecklistTemplate(params: { showGlp1: boolean }): {
  task_key: string;
  task_label: string;
  scheduled_after: string | null;
}[] {
  const core = [
    { task_key: 'log_weight', task_label: 'Log weight', scheduled_after: null as string | null },
    { task_key: 'log_meals', task_label: 'Log meals', scheduled_after: null },
    { task_key: 'log_supplements', task_label: 'Take supplements', scheduled_after: null },
    { task_key: 'move_body', task_label: 'Move your body', scheduled_after: null },
    { task_key: 'drink_water', task_label: 'Drink water', scheduled_after: null },
    { task_key: 'checkin_sona', task_label: 'Check in with Sona', scheduled_after: null },
  ];
  if (params.showGlp1) {
    return [
      core[0]!,
      core[1]!,
      { task_key: 'glp1_dose', task_label: 'Take GLP-1 (per your protocol)', scheduled_after: null },
      core[2]!,
      core[3]!,
      core[4]!,
      core[5]!,
    ];
  }
  return [core[0]!, core[1]!, core[2]!, core[3]!, core[4]!, core[5]!];
}

export function useDailyChecklist() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [calendar, setCalendar] = useState<{ date: string; symbol: '●' | '◐' | '○' }[]>([]);
  const [allDoneMessage, setAllDoneMessage] = useState<string | null>(null);
  const [milestoneToCelebrate, setMilestoneToCelebrate] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const patientId = await fetchPatientIdForAuthUser(user.id);
      if (!patientId) return;

      const today = todayIso();
      const calendarCutoff = new Date();
      calendarCutoff.setDate(calendarCutoff.getDate() - 30);
      const calendarFrom = localDateKey(calendarCutoff);

      const { data: glp1Row } = await supabase
        .from('glp1_records')
        .select('id')
        .eq('patient_id', patientId)
        .limit(1)
        .maybeSingle();
      const showGlp1 =
        canUseGlp1PatientFeatures(profile) ||
        profile?.wellness_track === 'glp1' ||
        Boolean(glp1Row?.id);

      const [{ data: checklistRows }] = await Promise.all([
        supabase
          .from('daily_checklist_items')
          .select('id, task_key, task_label, completed, completed_at, scheduled_after')
          .eq('patient_id', patientId)
          .eq('checklist_date', today)
          .order('created_at', { ascending: true }),
      ]);

      if (!checklistRows || checklistRows.length === 0) {
        const template = buildTodayChecklistTemplate({ showGlp1 });
        const { error: insErr } = await supabase.from('daily_checklist_items').insert(
          template.map((t) => ({
            patient_id: patientId,
            checklist_date: today,
            task_key: t.task_key,
            task_label: t.task_label,
            scheduled_after: t.scheduled_after,
          })),
        );
        if (insErr) {
          console.warn('[checklist] insert today failed', insErr.message);
        }
      }

      const { data: finalRows, error: loadErr } = await supabase
        .from('daily_checklist_items')
        .select('id, task_key, task_label, completed, completed_at, scheduled_after')
        .eq('patient_id', patientId)
        .eq('checklist_date', today)
        .order('created_at', { ascending: true });
      if (loadErr) {
        console.warn('[checklist] load failed', loadErr.message);
        setItems([]);
        return;
      }

      const now = nowTimeHHmm();
      const mapped: ChecklistItem[] = (finalRows ?? [])
        .filter((r) => !r.scheduled_after || String(r.scheduled_after).slice(0, 5) <= now)
        .map((r) => ({
          id: r.id as string,
          taskKey: r.task_key as string,
          taskLabel: r.task_label as string,
          completed: r.completed === true,
          completedAt: (r.completed_at as string | null) ?? null,
          scheduledAfter: (r.scheduled_after as string | null) ?? null,
        }));
      setItems(mapped);

      const { data: monthRows } = await supabase
        .from('daily_checklist_items')
        .select('checklist_date, completed')
        .eq('patient_id', patientId)
        .gte('checklist_date', calendarFrom)
        .order('checklist_date', { ascending: false });
      const byDate = new Map<string, { total: number; done: number }>();
      for (const r of monthRows ?? []) {
        const d = String(r.checklist_date);
        const curr = byDate.get(d) ?? { total: 0, done: 0 };
        curr.total += 1;
        if (r.completed === true) curr.done += 1;
        byDate.set(d, curr);
      }
      const cal = [...byDate.entries()]
        .sort((a, b) => (a[0] > b[0] ? -1 : 1))
        .slice(0, 14)
        .map(([date, v]) => ({ date, symbol: completionSymbol(v.total ? v.done / v.total : 0) }));
      setCalendar(cal);

      let s = 0;
      for (const entry of cal) {
        if (entry.symbol === '◐' || entry.symbol === '●') s += 1;
        else break;
      }
      setStreak(s);
      if (MILESTONES.has(s)) {
        const signal = `streak_${s}_celebrated`;
        const { data: already } = await supabase
          .from('engagement_events')
          .select('id')
          .eq('patient_id', patientId)
          .eq('event_type', 'streak_celebration')
          .eq('signal_type', signal)
          .maybeSingle();
        setMilestoneToCelebrate(already ? null : s);
      } else {
        setMilestoneToCelebrate(null);
      }

      const done = mapped.filter((i) => i.completed).length;
      if (mapped.length > 0 && done === mapped.length) {
        setAllDoneMessage(
          'Perfect day. Every item done. That consistency is exactly what moves the number.',
        );
      } else {
        setAllDoneMessage(null);
      }

      await supabase.from('patients').update({ last_active_at: new Date().toISOString() }).eq('id', patientId);
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  const acknowledgeMilestone = useCallback(async () => {
    if (!user || !milestoneToCelebrate) return;
    const patientId = await fetchPatientIdForAuthUser(user.id);
    if (!patientId) return;
    await supabase.from('engagement_events').insert({
      patient_id: patientId,
      event_type: 'streak_celebration',
      signal_type: `streak_${milestoneToCelebrate}_celebrated`,
      message_sent: `Celebrated ${milestoneToCelebrate}-day streak`,
      opened_at: new Date().toISOString(),
    });
    setMilestoneToCelebrate(null);
  }, [user, milestoneToCelebrate]);

  const toggle = useCallback(
    async (id: string, completed: boolean) => {
      const { error } = await supabase
        .from('daily_checklist_items')
        .update({
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq('id', id);
      if (error) {
        Alert.alert('Could not save', error.message);
        return;
      }
      await refresh();
    },
    [refresh],
  );

  const completion = useMemo(() => {
    const done = items.filter((i) => i.completed).length;
    return { done, total: items.length, rate: items.length ? done / items.length : 0 };
  }, [items]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    items,
    loading,
    toggle,
    completion,
    streak,
    calendar,
    allDoneMessage,
    milestoneToCelebrate,
    acknowledgeMilestone,
    refresh,
  };
}
