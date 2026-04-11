import { Redirect, Stack } from 'expo-router';

import { colors } from '@/constants/designSystem';
import { isProviderFacingRole } from '@/lib/authRouting';
import { hrefForProfile, patientOnboardingDone } from '@/lib/roleGuards';
import { useAuthStore } from '@/stores/authStore';

export default function ProviderLayout() {
  const session = useAuthStore((s) => s.session);
  const initialized = useAuthStore((s) => s.initialized);
  const profile = useAuthStore((s) => s.profile);
  const profileReady = useAuthStore((s) => s.profileReady);
  const patientOnboardingComplete = useAuthStore((s) => s.patientOnboardingComplete);

  if (initialized && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (
    initialized &&
    session &&
    profileReady &&
    profile &&
    profile.role !== 'super_admin' &&
    !isProviderFacingRole(profile.role)
  ) {
    return (
      <Redirect
        href={hrefForProfile(profile, patientOnboardingDone(profile, patientOnboardingComplete))}
      />
    );
  }

  if (initialized && session && profileReady && profile?.role === 'super_admin') {
    return <Redirect href="/admin/command" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.dark },
        headerTintColor: colors.gold,
        headerTitleStyle: { fontFamily: 'Jost_300Light', color: colors.white },
        contentStyle: { backgroundColor: colors.dark },
      }}
    />
  );
}
