export type UserRole =
  | 'super_admin'
  | 'clinic_owner'
  | 'provider'
  | 'clinic_patient'
  | 'consumer';

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
  created_at: string;
}
