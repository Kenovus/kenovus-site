import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { SonaSplashScreen } from '@/components/SonaSplashScreen';
import { getPostAuthHref, isPatientFacingRole } from '@/lib/authRouting';
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
    return <Redirect href="/(auth)/account-recovery" />;
  }

  const onboardingComplete =
    !isPatientFacingRole(profile.role) || patientOnboardingComplete === true;

  return <Redirect href={getPostAuthHref(profile, onboardingComplete, superAdminViewMode)} />;
}
