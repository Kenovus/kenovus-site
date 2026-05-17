import { useCallback, useEffect, useMemo, useState } from 'react';

import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

type VitalityState = {
  total: number;
  body: number;
  health: number;
  mindset: number;
  momentum: number;
  aesthetics: number;
  identity: number;
  insight: string;
  source: 'vitality_scores' | 'glp1_checkins_estimate' | 'onboarding_baseline' | 'default';
  lastUpdatedAt: string | null;
  loading: boolean;
};

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function useVitality() {
  const { user } = useAuth();
  const [state, setState] = useState<VitalityState>({
    total: 78,
    body: 80,
    health: 77,
    mindset: 74,
    momentum: 81,
    aesthetics: 76,
    identity: 79,
    insight: 'Your score is trending in the right direction. Keep today simple and consistent.',
    source: 'default',
    lastUpdatedAt: null,
    loading: true,
  });

  const refresh = useCallback(async () => {
    if (!user) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    const patientId = await fetchPatientIdForAuthUser(user.id);
    if (!patientId) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    const consumeRow = (
      row: {
        body_score?: number | null;
        health_score?: number | null;
        mindset_score?: number | null;
        momentum_score?: number | null;
        aesthetics_score?: number | null;
        identity_score?: number | null;
        total_score?: number | null;
        sleep_hours?: number | null;
      },
      source: VitalityState['source'],
      lastUpdatedAt: string | null,
      insight: string,
    ) => {
      const body = clampScore(row.body_score ?? 78);
      const health = clampScore(row.health_score ?? 78);
      const mindset = clampScore(row.mindset_score ?? 76);
      const momentum = clampScore(row.momentum_score ?? 80);
      const aesthetics = clampScore(row.aesthetics_score ?? 74);
      const identity = clampScore(row.identity_score ?? 77);
      const total = clampScore(
        row.total_score ??
          Math.round(body * 0.22 + health * 0.22 + mindset * 0.18 + momentum * 0.18 + aesthetics * 0.1 + identity * 0.1),
      );

      setState({
        total,
        body,
        health,
        mindset,
        momentum,
        aesthetics,
        identity,
        insight,
        source,
        lastUpdatedAt,
        loading: false,
      });
    };

    const { data: latestScore, error: latestError } = await supabase
      .from('vitality_scores')
      .select('*')
      .eq('patient_id', patientId)
      .order('score_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      console.warn('[useVitality] read latest score', latestError.message);
    }
    if (latestScore) {
      const insight =
        latestScore.sleep_hours != null && Number(latestScore.sleep_hours) < 6.5
          ? 'Sleep came in low. Prioritize hydration and protein early to stabilize your score today.'
          : 'Consistency is working. Keep check-ins tight and finish your key actions by tonight.';
      consumeRow(
        latestScore,
        'vitality_scores',
        latestScore.score_date ? `${latestScore.score_date}T12:00:00.000Z` : latestScore.created_at ?? null,
        insight,
      );
      return;
    }

    const { data: latestCheckin, error: checkinError } = await supabase
      .from('glp1_checkins')
      .select('*')
      .eq('patient_id', patientId)
      .order('checkin_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (checkinError) {
      console.warn('[useVitality] read latest checkin', checkinError.message);
    }
    if (latestCheckin) {
      const symptomBurden =
        Number(latestCheckin.nausea ?? 0) +
        Number(latestCheckin.fatigue ?? 0) +
        Number(latestCheckin.headache ?? 0) +
        Number(latestCheckin.constipation ?? 0) +
        Number(latestCheckin.diarrhea ?? 0) +
        Number(latestCheckin.injection_site_reaction ?? 0);
      const burdenPenalty = Math.min(24, symptomBurden * 2);
      const feeling = Number(latestCheckin.overall_feeling ?? 3);
      const appetite = Number(latestCheckin.appetite ?? 0);
      const body = clampScore(80 - burdenPenalty * 0.8);
      const health = clampScore(78 - burdenPenalty * 0.6);
      const mindset = clampScore(70 + feeling * 5 - appetite);
      const momentum = clampScore(72 + feeling * 4);
      const aesthetics = clampScore(74 + Math.max(0, 3 - appetite));
      const identity = clampScore(75 + feeling * 4);
      const total = clampScore(
        body * 0.22 + health * 0.22 + mindset * 0.18 + momentum * 0.18 + aesthetics * 0.1 + identity * 0.1,
      );
      consumeRow(
        {
          body_score: body,
          health_score: health,
          mindset_score: mindset,
          momentum_score: momentum,
          aesthetics_score: aesthetics,
          identity_score: identity,
          total_score: total,
        },
        'glp1_checkins_estimate',
        latestCheckin.checkin_date ? `${latestCheckin.checkin_date}T12:00:00.000Z` : latestCheckin.created_at ?? null,
        'Estimated from your latest GLP-1 check-in while we wait for a formal vitality score sync.',
      );
      return;
    }

    const { data: onboardingCtx, error: onboardingError } = await supabase
      .from('patient_onboarding_context')
      .select('readiness_score, completed_at')
      .eq('patient_id', patientId)
      .maybeSingle();
    if (onboardingError) {
      console.warn('[useVitality] read onboarding baseline', onboardingError.message);
    }
    if (onboardingCtx?.readiness_score != null) {
      const readiness = Number(onboardingCtx.readiness_score);
      const baseline = clampScore(55 + readiness * 3);
      consumeRow(
        {
          body_score: baseline - 2,
          health_score: baseline,
          mindset_score: baseline + 2,
          momentum_score: baseline - 1,
          aesthetics_score: baseline - 3,
          identity_score: baseline + 1,
          total_score: baseline,
        },
        'onboarding_baseline',
        onboardingCtx.completed_at ?? null,
        'This baseline is derived from your onboarding readiness and will refine as check-ins and scores come in.',
      );
      return;
    }

    consumeRow(
      {
        body_score: 78,
        health_score: 76,
        mindset_score: 74,
        momentum_score: 80,
        aesthetics_score: 73,
        identity_score: 77,
        total_score: 77,
      },
      'default',
      null,
      'Start daily check-ins to personalize your vitality score and guidance.',
    );
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo(
    () => ({
      ...state,
      refresh,
    }),
    [state, refresh],
  );
}
