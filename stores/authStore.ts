import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import type { UserProfile } from '@/types/user';

type AuthState = {
  session: Session | null;
  profile: UserProfile | null;
  patientOnboardingComplete: boolean | null;
  initialized: boolean;
  profileReady: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setPatientOnboardingComplete: (value: boolean | null) => void;
  setInitialized: (value: boolean) => void;
  setProfileReady: (value: boolean) => void;
  reset: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  patientOnboardingComplete: null,
  initialized: false,
  profileReady: false,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setPatientOnboardingComplete: (patientOnboardingComplete) =>
    set({ patientOnboardingComplete }),
  setInitialized: (initialized) => set({ initialized }),
  setProfileReady: (profileReady) => set({ profileReady }),
  reset: () =>
    set({
      session: null,
      profile: null,
      patientOnboardingComplete: null,
      profileReady: true,
    }),
}));
