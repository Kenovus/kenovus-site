import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { SonaSplashScreen } from '@/components/SonaSplashScreen';
import { getPostAuthHref, isPatientFacingRole } from '@/lib/authRouting';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export default function Index() {
  const initialized = useAuthStore((s) => s.initialized);
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const profileReady = useAuthStore((s) => s.profileReady);
  const patientOnboardingComplete = useAuthStore((s) => s.patientOnboardingComplete);
  const superAdminViewMode = useAuthStore((s) => s.superAdminViewMode);
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);
  const [routeReady, setRouteReady] = useState(false);
  const [slowAuthSpinner, setSlowAuthSpinner] = useState(false);

  const authBootstrapDone = initialized && (!session || profileReady);

  useEffect(() => {
    const t = setTimeout(() => setMinSplashElapsed(true), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (authBootstrapDone) {
      setSlowAuthSpinner(false);
      return;
    }
    const t = setTimeout(() => {
      setSlowAuthSpinner(true);
    }, 3000);
    return () => clearTimeout(t);
  }, [authBootstrapDone]);

  useEffect(() => {
    if (authBootstrapDone && minSplashElapsed) {
      setRouteReady(true);
    }
  }, [authBootstrapDone, minSplashElapsed]);

  if (!routeReady) {
    return <SonaSplashScreen />;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!profile) {
    // syncAuthProfile already tried to auto-create the profile. If it's still missing,
    // attempt one more upsert here and route home — never block a logged-in user.
    void supabase
      .from('user_profiles')
      .upsert(
        {
          auth_user_id: session.user.id,
          role: 'consumer',
          full_name: session.user.email?.split('@')[0] ?? 'User',
          email: session.user.email ?? null,
          consumer_tier: 'free',
        },
        { onConflict: 'auth_user_id', ignoreDuplicates: true },
      )
      .then(() => {
        // Trigger a profile reload after the upsert
        useAuthStore.getState().setProfileReady(false);
        useAuthStore.getState().setProfileReady(true);
      })
      .catch((e) => console.warn('[index] profile fallback upsert failed:', e));

    // Route to consumer home; the app will re-render once the profile loads
    return <Redirect href="/patient/dashboard" />;
  }

  const onboardingComplete =
    !isPatientFacingRole(profile.role) || patientOnboardingComplete === true;

  return <Redirect href={getPostAuthHref(profile, onboardingComplete, superAdminViewMode)} />;
}
