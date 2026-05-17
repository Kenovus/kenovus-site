import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { fetchPatientGoals } from '@/lib/patientGoals';

/**
 * After the daily greeting is dismissed, send patients without a goal profile to My Goals once per session.
 */
export function usePostGreetingGoalPrompt(showDailyGreeting: boolean, greetingDateLoaded: boolean) {
  const router = useRouter();
  const { user } = useAuth();
  const promptedRef = useRef(false);

  useEffect(() => {
    if (!greetingDateLoaded || showDailyGreeting || !user?.id || promptedRef.current) return;

    let cancelled = false;
    void (async () => {
      const pid = await fetchPatientIdForAuthUser(user.id);
      if (cancelled) return;
      if (!pid) {
        promptedRef.current = true;
        return;
      }
      const goals = await fetchPatientGoals(pid);
      if (cancelled) return;
      promptedRef.current = true;
      if (goals?.primary_goal) return;
      router.push('/patient/profile/my-goals?source=post_greeting');
    })();

    return () => {
      cancelled = true;
    };
  }, [greetingDateLoaded, showDailyGreeting, router, user?.id]);
}
