import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { daysUntilTargetDate, type PatientGoalsRow } from '@/lib/patientGoals';
import { formatPhaseHomeLine, isPeakWeek, weeksOutFromTargetDate } from '@/lib/phaseDisplay';
import { supabase } from '@/lib/supabase';

type Props = {
  goalsRow: PatientGoalsRow | null;
  goalsLoading: boolean;
  checklistStreak: number;
};

/** Guided / self-guided home: training phase, stage countdown, peak week, longevity streak. */
export function GoalHomeCallouts({ goalsRow, goalsLoading, checklistStreak }: Props) {
  const { user } = useAuth();
  const [photoLine, setPhotoLine] = useState<string | null>(null);

  const loadPhotos = useCallback(async () => {
    if (!user?.id || goalsRow?.primary_goal !== 'stage_ready') {
      setPhotoLine(null);
      return;
    }
    const pid = await fetchPatientIdForAuthUser(user.id);
    if (!pid) return;
    const d = new Date();
    const day = d.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(d);
    mon.setDate(d.getDate() + diffToMon);
    mon.setHours(0, 0, 0, 0);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const iso = (x: Date) => x.toISOString().slice(0, 10);
    const from = iso(mon);
    const to = iso(sun);
    const { count, error } = await supabase
      .from('progress_photos')
      .select('id', { count: 'exact', head: true })
      .eq('patient_id', pid)
      .gte('photo_date', from)
      .lte('photo_date', to);
    if (error) return;
    const c = count ?? 0;
    if (c < 3) {
      setPhotoLine(`Stage prep: log front, side, and back photos this week (${c}/3 angles logged).`);
    } else {
      setPhotoLine(null);
    }
  }, [user?.id, goalsRow?.primary_goal]);

  useEffect(() => {
    void loadPhotos();
  }, [loadPhotos]);

  if (goalsLoading || !goalsRow) return null;

  const phaseLine = formatPhaseHomeLine(goalsRow);
  const peak = goalsRow.primary_goal === 'stage_ready' && isPeakWeek(goalsRow.target_date);
  const weeksOut = goalsRow.primary_goal === 'stage_ready' ? weeksOutFromTargetDate(goalsRow.target_date) : null;
  const daysOut = goalsRow.primary_goal === 'stage_ready' ? daysUntilTargetDate(goalsRow.target_date) : null;

  return (
    <View style={{ gap: 12 }}>
      {phaseLine ? (
        <View style={styles.callout}>
          <Text style={styles.title}>Training phase</Text>
          <Text style={styles.phaseMain}>{phaseLine}</Text>
        </View>
      ) : null}

      {goalsRow.primary_goal === 'stage_ready' && goalsRow.target_date ? (
        <View style={[styles.callout, peak && styles.peak]}>
          <Text style={styles.title}>{peak ? 'Peak week window' : 'Stage countdown'}</Text>
          <Text style={styles.big}>{weeksOut != null ? `${weeksOut}` : '—'}</Text>
          <Text style={styles.sub}>weeks out{daysOut != null ? ` · ${daysOut} day(s) to show` : ''}</Text>
          {peak ? (
            <Text style={styles.peakNote}>
              Educational only: peak-week water and sodium strategies belong in person with Simi Kennedy CRNA ARNP —
              never self-prescribe shifts.
            </Text>
          ) : null}
        </View>
      ) : null}

      {photoLine ? (
        <View style={styles.calloutMuted}>
          <Text style={styles.sub}>{photoLine}</Text>
        </View>
      ) : null}

      {goalsRow.primary_goal === 'health_longevity' ? (
        <View style={styles.callout}>
          <Text style={styles.title}>Consistency streak</Text>
          <Text style={styles.big}>{checklistStreak}</Text>
          <Text style={styles.sub}>days at 50%+ checklist completion</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  callout: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: 'rgba(201,168,76,0.1)',
    padding: 16,
    alignItems: 'center',
  },
  calloutMuted: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: colors.darkCard,
    padding: 14,
  },
  peak: {
    borderColor: colors.goldLight,
    backgroundColor: 'rgba(201,168,76,0.18)',
  },
  title: {
    ...typography.label,
    color: colors.gold,
    marginBottom: 6,
    letterSpacing: 1.5,
  },
  phaseMain: {
    ...typography.body,
    color: colors.white,
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '600',
  },
  big: {
    fontFamily: 'PTSerif_400Regular',
    fontSize: 48,
    color: colors.white,
    lineHeight: 52,
  },
  sub: {
    ...typography.body,
    color: colors.gray1,
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  peakNote: {
    ...typography.body,
    color: colors.gray1,
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
  },
});
