import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/constants/designSystem';
import { getPostAuthHref, isPatientFacingRole } from '@/lib/authRouting';
import { useAuthStore } from '@/stores/authStore';

const SPLASH_MS = 2000;

export default function Index() {
  const initialized = useAuthStore((s) => s.initialized);
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const profileReady = useAuthStore((s) => s.profileReady);
  const patientOnboardingComplete = useAuthStore((s) => s.patientOnboardingComplete);

  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  if (!initialized || !splashDone || !profileReady) {
    return (
      <View style={styles.splash}>
        <Text style={styles.wordmark}>SonaLife</Text>
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!profile) {
    return <Redirect href="/(auth)/login" />;
  }

  const onboardingComplete =
    !isPatientFacingRole(profile.role) || patientOnboardingComplete === true;

  return <Redirect href={getPostAuthHref(profile, onboardingComplete)} />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    ...typography.h1,
    color: colors.gold,
    letterSpacing: 4,
  },
});
