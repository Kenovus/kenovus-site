import {
  CormorantGaramond_300Light,
  CormorantGaramond_500Medium,
} from '@expo-google-fonts/cormorant-garamond';
import { DMSans_300Light, DMSans_400Regular, DMSans_500Medium } from '@expo-google-fonts/dm-sans';
import {
  PTSerif_400Regular,
  PTSerif_400Regular_Italic,
  PTSerif_700Bold,
} from '@expo-google-fonts/pt-serif';
import { Jost_200ExtraLight, Jost_300Light, Jost_300Light_Italic } from '@expo-google-fonts/jost';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';

import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { SonaSplashScreen } from '@/components/SonaSplashScreen';
import { InputDoneAccessoryView } from '@/components/ui/InputDoneAccessoryView';
import { SonaVoiceProvider } from '@/contexts/SonaVoiceContext';
import { AppThemeProvider, useAppTheme } from '@/lib/theme/ThemeProvider';
import { syncAuthProfile } from '@/lib/syncAuthProfile';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

import 'react-native-reanimated';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <SonaVoiceProvider>
        <AppThemeProvider>
          <RootStack />
        </AppThemeProvider>
      </SonaVoiceProvider>
    </AppErrorBoundary>
  );
}

function RootStack() {
  const { tokens, resolvedTheme } = useAppTheme();
  const initialized   = useAuthStore((s) => s.initialized);
  const hasShownSplash = useRef(false);
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);

  const [loaded, fontError] = useFonts({
    CormorantGaramond_300Light,
    CormorantGaramond_500Medium,
    PTSerif_400Regular,
    PTSerif_400Regular_Italic,
    PTSerif_700Bold,
    DMSans_300Light,
    DMSans_400Regular,
    DMSans_500Medium,
    Jost_200ExtraLight,
    Jost_300Light,
    Jost_300Light_Italic,
  });

  // Font errors are non-fatal — log and continue rather than crashing the app
  useEffect(() => {
    if (fontError) console.warn('[SonaLife] font load error (non-fatal):', fontError);
  }, [fontError]);

  // Minimum splash display time
  useEffect(() => {
    const t = setTimeout(() => setMinSplashElapsed(true), 600);
    return () => clearTimeout(t);
  }, []);

  // Absolute 3-second failsafe — app MUST enter regardless of any hang
  useEffect(() => {
    const t = setTimeout(() => {
      console.warn('[SonaLife] 3-second hard cap hit — forcing app entry');
      const s = useAuthStore.getState();
      if (!s.profileReady) s.setProfileReady(true);
      if (!s.initialized)  s.setInitialized(true);
      setMinSplashElapsed(true);
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  // ── Auth bootstrap — ONLY critical path on startup ──────────────────────────
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const store = useAuthStore.getState();
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        store.setSession(session);

        if (session?.user) {
          // 1.5-second hard cap — matches loading bar duration exactly
          await Promise.race([
            syncAuthProfile(session.user),
            new Promise<void>((res) => setTimeout(res, 1500)),
          ]);
          if (!useAuthStore.getState().profileReady) {
            console.warn('[SonaLife] auth bootstrap timeout — proceeding');
            useAuthStore.getState().setProfileReady(true);
          }
        } else {
          store.reset();
        }
      } catch (e) {
        console.warn('[SonaLife] auth bootstrap failed (non-fatal):', e);
        useAuthStore.getState().setProfileReady(true);
      } finally {
        if (!cancelled) useAuthStore.getState().setInitialized(true);
      }
    })();

    // Auth state listener — re-syncs profile on login/logout/token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const keepProfileReady = event === 'TOKEN_REFRESHED';
      try {
        useAuthStore.getState().setSession(session);
        if (session?.user) await syncAuthProfile(session.user, { keepProfileReady });
        else useAuthStore.getState().reset();
      } catch (e) {
        console.warn('[SonaLife] auth state change sync failed (non-fatal):', e);
        useAuthStore.getState().setProfileReady(true);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // ── Deferred non-critical startup (5 s after app is visible) ────────────────
  useEffect(() => {
    if (!initialized) return;
    const t = setTimeout(() => {
      // Notification handler registration — deferred so it never blocks launch
      void (async () => {
        try {
          const { registerNotificationForegroundHandler } =
            await import('@/lib/notifications/patientNotifications');
          registerNotificationForegroundHandler();
        } catch (e) {
          console.warn('[SonaLife] notification setup failed (non-fatal):', e);
        }
      })();
    }, 5000);
    return () => clearTimeout(t);
  }, [initialized]);

  // Hide native splash when everything is ready — animated splash takes over
  useEffect(() => {
    if (loaded && initialized && minSplashElapsed) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, initialized, minSplashElapsed]);

  // Show animated splash on first render and while loading
  if (!hasShownSplash.current) {
    hasShownSplash.current = true;
    return <SonaSplashScreen />;
  }
  if (!loaded || !initialized || !minSplashElapsed) {
    return <SonaSplashScreen />;
  }

  return (
    <>
      <InputDoneAccessoryView />
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: tokens.colors.background },
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

// useFonts must be imported here after the font packages
import { useFonts } from 'expo-font';
