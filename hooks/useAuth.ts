import { useCallback } from 'react';

import { syncAuthProfile } from '@/lib/syncAuthProfile';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export function useAuth() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const patientOnboardingComplete = useAuthStore((s) => s.patientOnboardingComplete);
  const superAdminViewMode = useAuthStore((s) => s.superAdminViewMode);
  const initialized = useAuthStore((s) => s.initialized);

  const refreshProfile = useCallback(
    async (opts?: { keepProfileReady?: boolean }) => {
      await syncAuthProfile(session?.user ?? null, opts);
    },
    [session?.user],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };
    if (data.session?.user) await syncAuthProfile(data.session.user);
    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error };
    if (data.session?.user) await syncAuthProfile(data.session.user);
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    useAuthStore.getState().reset();
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'sonalife://reset-password',
    });
    return { error };
  }, []);

  return {
    session,
    user: session?.user ?? null,
    profile,
    patientOnboardingComplete,
    superAdminViewMode,
    initialized,
    setSuperAdminViewMode: useAuthStore.getState().setSuperAdminViewMode,
    toggleSuperAdminSurface: () =>
      useAuthStore
        .getState()
        .setSuperAdminViewMode(superAdminViewMode === 'admin' ? 'patient' : 'admin'),
    refreshProfile,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
  };
}
