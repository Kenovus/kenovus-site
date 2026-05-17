import { Redirect, Stack } from 'expo-router';

import { useAppTheme } from '@/lib/theme/ThemeProvider';
import { hrefForProfile, patientOnboardingDone } from '@/lib/roleGuards';
import { useAuthStore } from '@/stores/authStore';

export default function AdminLayout() {
  const { tokens } = useAppTheme();
  const session  = useAuthStore((s) => s.session);
  const initialized = useAuthStore((s) => s.initialized);
  const profile  = useAuthStore((s) => s.profile);
  const profileReady = useAuthStore((s) => s.profileReady);
  const patientOnboardingComplete = useAuthStore((s) => s.patientOnboardingComplete);

  if (initialized && !session) return <Redirect href="/(auth)/login" />;

  // Allow super_admin, clinic_owner, clinic_admin, provider (not just super_admin)
  const ADMIN_ROLES = ['super_admin', 'clinic_owner', 'clinic_admin', 'provider'];
  if (initialized && session && profileReady && profile && !ADMIN_ROLES.includes(profile.role)) {
    return <Redirect href={hrefForProfile(profile, patientOnboardingDone(profile, patientOnboardingComplete))} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: tokens.colors.background },
        headerTintColor: tokens.colors.accent,
        headerTitleStyle: { ...tokens.typography.body, color: tokens.colors.text },
        contentStyle: { backgroundColor: tokens.colors.background },
      }}>
      <Stack.Screen name="command"      options={{ title: 'Admin' }} />
      <Stack.Screen name="provisioning" options={{ title: 'Provisioning' }} />
      <Stack.Screen name="clinics"      options={{ title: 'Clinics' }} />
      <Stack.Screen name="finance"      options={{ title: 'Finance' }} />
      <Stack.Screen name="expenses"     options={{ title: 'Expenses' }} />
      <Stack.Screen name="mileage"      options={{ title: 'Mileage Tracker' }} />
      <Stack.Screen name="platform"     options={{ title: 'Platform Health' }} />
      <Stack.Screen name="pipeline"     options={{ title: 'Growth Pipeline' }} />
      <Stack.Screen name="training"                  options={{ title: 'Staff Training' }} />
      <Stack.Screen name="transformation-stories"    options={{ title: 'Transformation Stories' }} />
      <Stack.Screen name="transformations"           options={{ title: 'Transformations' }} />
      <Stack.Screen name="clinical-metrics" options={{ title: 'Clinical Metrics' }} />
      <Stack.Screen name="referrals"    options={{ title: 'Referrals' }} />
    </Stack>
  );
}
