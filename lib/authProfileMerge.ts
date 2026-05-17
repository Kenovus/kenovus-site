import { useAuthStore } from '@/stores/authStore';
import type { UserProfile } from '@/types/user';

/** Merge a freshly updated `user_profiles` row into the in-memory profile without a full refetch. */
export function mergeServerUserProfileRow(row: Record<string, unknown>): void {
  const prev = useAuthStore.getState().profile;
  if (!prev) return;
  const authId = row.auth_user_id;
  if (String(authId) !== prev.auth_user_id) return;
  useAuthStore.getState().setProfile({ ...prev, ...(row as unknown as UserProfile) });
}
