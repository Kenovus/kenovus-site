import {
  CormorantGaramond_300Light,
  useFonts,
} from '@expo-google-fonts/cormorant-garamond';
import { Jost_300Light } from '@expo-google-fonts/jost';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { colors } from '@/constants/designSystem';
import { syncAuthProfile } from '@/lib/syncAuthProfile';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

import 'react-native-reanimated';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, fontError] = useFonts({
    CormorantGaramond_300Light,
    Jost_300Light,
  });

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    if (!loaded) return;

    let cancelled = false;

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      const store = useAuthStore.getState();
      store.setSession(session);
      if (session?.user) await syncAuthProfile(session.user);
      else store.reset();
      store.setInitialized(true);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const store = useAuthStore.getState();
      store.setSession(session);
      if (session?.user) await syncAuthProfile(session.user);
      else store.reset();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loaded]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.dark },
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="patient" />
        <Stack.Screen name="provider" />
        <Stack.Screen name="admin" />
      </Stack>
    </>
  );
}
