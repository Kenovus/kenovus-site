import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';

import { colors } from '@/constants/designSystem';
import { guidedTabBar } from '@/constants/guidedUi';
import { isPatientFacingRole } from '@/lib/authRouting';
import { hrefForProfile, patientOnboardingDone } from '@/lib/roleGuards';
import { normalizeUiMode } from '@/types/onboarding';
import { useAuthStore } from '@/stores/authStore';

export default function PatientLayout() {
  const session = useAuthStore((s) => s.session);
  const initialized = useAuthStore((s) => s.initialized);
  const profile = useAuthStore((s) => s.profile);
  const profileReady = useAuthStore((s) => s.profileReady);
  const patientOnboardingComplete = useAuthStore((s) => s.patientOnboardingComplete);

  const guided = profile ? normalizeUiMode(profile) === 'guided' : false;

  if (initialized && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (initialized && session && profileReady && profile && !isPatientFacingRole(profile.role)) {
    return (
      <Redirect
        href={hrefForProfile(profile, patientOnboardingDone(profile, patientOnboardingComplete))}
      />
    );
  }

  return (
    <Tabs
      initialRouteName={guided ? 'guided-home' : 'dashboard'}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.darkCard,
          borderTopColor: colors.goldDim,
          ...(guided ? { minHeight: guidedTabBar.minHeight, paddingTop: 6 } : {}),
        },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.gray2,
        tabBarLabelStyle: {
          fontFamily: 'Jost_300Light',
          fontSize: guided ? guidedTabBar.labelFontSize : 11,
        },
      }}>
      <Tabs.Screen
        name="guided-home"
        options={{
          title: 'Home',
          href: guided ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              color={color}
              name="home-outline"
              size={guided ? guidedTabBar.iconSize : size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: 'Appointments',
          href: guided ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              color={color}
              name="calendar-outline"
              size={guided ? guidedTabBar.iconSize : size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          href: guided ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: 'Coach',
          href: guided ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          href: guided ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'Fuel',
          href: guided ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="nutrition-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="store"
        options={{
          title: 'Store',
          href: guided ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bag-handle-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="book"
        options={{
          title: 'Book',
          href: guided ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              color={color}
              name="person-outline"
              size={guided ? guidedTabBar.iconSize : size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
