import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { listInBodyScansForAuthUser } from '@/lib/inbody';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { localDateKey } from '@/lib/patientSupplements';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const DISMISS_KEY = 'sonalife_google_review_card_dismissed_v1';

export function useGoogleReviewMilestone(checklistStreak: number) {
  const { user } = useAuth();
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!user?.id) {
        setShowCard(false);
        return;
      }
      const dismissed = await AsyncStorage.getItem(DISMISS_KEY);
      if (dismissed === '1') {
        setShowCard(false);
        return;
      }

      let qualified = checklistStreak >= 3;

      if (!qualified) {
        const { rows } = await listInBodyScansForAuthUser(user.id);
        qualified = rows.length >= 1;
      }

      const patientId = await fetchPatientIdForAuthUser(user.id);
      if (!qualified && patientId) {
        const { count: weeklyCount } = await supabase
          .from('patient_supplement_weekly_checkins')
          .select('id', { count: 'exact', head: true })
          .eq('patient_id', patientId);
        qualified = (weeklyCount ?? 0) >= 1;
      }

      if (!qualified && patientId) {
        const end = new Date();
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        const from = localDateKey(start);
        const { count: takenCount } = await supabase
          .from('patient_supplement_daily_logs')
          .select('id', { count: 'exact', head: true })
          .eq('patient_id', patientId)
          .eq('taken', true)
          .gte('log_date', from);
        qualified = (takenCount ?? 0) >= 5;
      }

      if (!cancelled) setShowCard(qualified);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, checklistStreak]);

  const dismissCard = useCallback(async () => {
    await AsyncStorage.setItem(DISMISS_KEY, '1');
    setShowCard(false);
  }, []);

  return { showCard, dismissCard };
}
