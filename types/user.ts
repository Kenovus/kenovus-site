export type UserRole =
  | 'super_admin'
  | 'clinic_owner'
  | 'provider'
  | 'clinic_patient'
  | 'consumer';

/** `'explorer'` is stored in Supabase for the self-guided (full-tab) experience. */
export type UIMode = 'guided' | 'explorer';

export type WellnessTrack =
  | 'glp1'
  | 'hormone_optimization'
  | 'fitness_recomp'
  | 'wellness';

export interface UserProfile {
  id: string;
  auth_user_id: string;
  role: UserRole;
  secondary_role: 'clinic_patient' | null;
  clinic_id: string | null;
  full_name: string | null;
  email: string | null;
  ui_mode: UIMode | null;
  ui_mode_set_at: string | null;
  wellness_track: WellnessTrack | null;
  consumer_tier: 'free' | 'core' | 'glp1_plus' | null;
  /** Weight entry UI preference (see migration `weight_logs_user_prefs`). */
  weight_unit_preference?: 'lb' | 'kg' | null;
  /** Optional: train-day vs rest-day carb emphasis (weekly calories unchanged). */
  carb_cycling_enabled?: boolean | null;
  /** Show protein as g/kg and g/lb alongside grams. */
  show_macro_per_kg?: boolean | null;
  /** When true, coaching uses 7-day rolling average weight (stored daily weights unchanged). */
  use_rolling_weight_for_coaching?: boolean | null;
  /** When false (e.g. aesthetics-only staff), hide clinical blocks in provider UI. */
  provider_clinical_access?: boolean | null;
  /** Consumer onboarding / coach persona (see migration `user_profiles_persona_columns`). */
  age_range?: string | null;
  activity_level_persona?: string | null;
  primary_persona?: string | null;
  persona_goal?: string | null;
  created_at: string;
}
