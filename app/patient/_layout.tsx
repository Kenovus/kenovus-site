import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { Fragment, useEffect, useRef } from 'react';

import { SonaTabBarIcon } from '@/components/patient/SonaTabBarIcon';
import { WeeklySupplementCheckinGate } from '@/components/patient/WeeklySupplementCheckinGate';
import { guidedTabBar } from '@/constants/guidedUi';
import { useSonaVoice } from '@/contexts/SonaVoiceContext';
import { canUsePatientSurface } from '@/lib/authRouting';
import { canSyncWearables } from '@/lib/consumerTier';
import { localDateKey } from '@/lib/dashboardStorage';
import { syncAppleHealthSnapshotToVitality } from '@/lib/health/appleHealthSync';
import { bootstrapPatientNotifications } from '@/lib/notifications/patientNotifications';
import { hrefForProfile, patientOnboardingDone } from '@/lib/roleGuards';
import { useAppTheme } from '@/lib/theme/ThemeProvider';
import { useAuthStore } from '@/stores/authStore';

export default function PatientLayout() {
  const { tokens } = useAppTheme();
  const { sonaState } = useSonaVoice();
  const session = useAuthStore((s) => s.session);
  const initialized = useAuthStore((s) => s.initialized);
  const profile = useAuthStore((s) => s.profile);
  const profileReady = useAuthStore((s) => s.profileReady);
  const patientOnboardingComplete = useAuthStore((s) => s.patientOnboardingComplete);
  const superAdminViewMode = useAuthStore((s) => s.superAdminViewMode);

  const needsClinicOnboarding =
    profile?.role === 'clinic_patient' && patientOnboardingComplete === false;
  const initialRouteName = needsClinicOnboarding ? 'clinic-onboarding' : 'home';
  const lastNotifBootstrapUser = useRef<string | null>(null);
  const lastHealthSyncKey = useRef<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) {
      lastNotifBootstrapUser.current = null;
      return;
    }
    if (!profileReady || !profile) return;
    if (!canUsePatientSurface(profile, superAdminViewMode)) return;
    if (lastNotifBootstrapUser.current === session.user.id) return;
    lastNotifBootstrapUser.current = session.user.id;
    void bootstrapPatientNotifications(session.user.id);
  }, [session?.user?.id, profileReady, profile, superAdminViewMode]);

  useEffect(() => {
    if (!session?.user?.id) {
      lastHealthSyncKey.current = null;
      return;
    }
    if (!profileReady || !profile) return;
    if (!canUsePatientSurface(profile, superAdminViewMode)) return;
    if (!canSyncWearables(profile)) return;

    const day = localDateKey();
    const key = `${session.user.id}:${day}`;
    if (lastHealthSyncKey.current === key) return;
    lastHealthSyncKey.current = key;

    void syncAppleHealthSnapshotToVitality(session.user.id);
  }, [session?.user?.id, profileReady, profile, superAdminViewMode]);

  if (initialized && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (initialized && session && profileReady && profile && !canUsePatientSurface(profile, superAdminViewMode)) {
    return (
      <Redirect
        href={hrefForProfile(profile, patientOnboardingDone(profile, patientOnboardingComplete), superAdminViewMode)}
      />
    );
  }

  const tabIconSize = guidedTabBar.iconSize;
  const tabLabelSize = guidedTabBar.labelFontSize;

  return (
    <Fragment>
      <Tabs
        initialRouteName={initialRouteName}
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: tokens.colors.surface,
            borderTopColor: tokens.colors.border,
            minHeight: guidedTabBar.minHeight,
            paddingTop: 6,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -3 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 12,
          },
          tabBarActiveTintColor: '#b8976a',
          tabBarInactiveTintColor: tokens.colors.textCaption,
          tabBarLabelStyle: {
            fontFamily: 'DMSans_400Regular',
            fontSize: tabLabelSize,
          },
        }}>
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <Ionicons color={color} name="home-outline" size={tabIconSize ?? size} />
            ),
          }}
        />
        <Tabs.Screen
          name="sona"
          options={{
            title: 'Sona',
            tabBarIcon: ({ color, size }) => (
              <SonaTabBarIcon
                color={color}
                size={tabIconSize ?? size}
                listening={sonaState === 'listening'}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="nutrition"
          options={{
            title: 'Nutrition',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="restaurant-outline" color={color} size={tabIconSize ?? size} />
            ),
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progress',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="trending-up-outline" color={color} size={tabIconSize ?? size} />
            ),
          }}
        />
        <Tabs.Screen
          name="train"
          options={{
            title: 'Train',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="barbell-outline" color={color} size={tabIconSize ?? size} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" color={color} size={tabIconSize ?? size} />
            ),
          }}
        />
        <Tabs.Screen name="more" options={{ href: null }} />
        <Tabs.Screen name="guided-home" options={{ href: null }} />
        <Tabs.Screen name="dashboard" options={{ href: null }} />
        <Tabs.Screen name="coach" options={{ href: null }} />
        <Tabs.Screen name="appointments" options={{ href: null }} />
        <Tabs.Screen name="store" options={{ href: null }} />
        <Tabs.Screen name="book" options={{ href: null }} />
        <Tabs.Screen name="clinic-onboarding" options={{ href: null }} />
        <Tabs.Screen name="check-in"                        options={{ href: null }} />
        <Tabs.Screen name="clinical-research"               options={{ href: null }} />
        <Tabs.Screen name="progress/scan"               options={{ href: null }} />
        <Tabs.Screen name="profile/appointments-log"    options={{ href: null }} />
      </Tabs>
      <WeeklySupplementCheckinGate />
    </Fragment>
  );
}
