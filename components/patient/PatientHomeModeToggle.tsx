import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { mergeServerUserProfileRow } from '@/lib/authProfileMerge';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/lib/theme/ThemeProvider';
import { useAuth } from '@/hooks/useAuth';
import { normalizeUiMode } from '@/types/onboarding';
import type { UIMode } from '@/types/user';

export function PatientHomeModeToggle() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const { tokens } = useAppTheme();
  const styles = createStyles(tokens);
  const [busy, setBusy] = useState(false);

  const serverMode: 'guided' | 'explorer' =
    profile == null ? 'guided' : normalizeUiMode(profile);
  const [optimisticMode, setOptimisticMode] = useState<'guided' | 'explorer' | null>(null);
  const activeMode = optimisticMode ?? serverMode;
  const guidedSelected = activeMode === 'guided';
  const selfGuidedSelected = activeMode === 'explorer';

  const applyMode = useCallback(
    async (mode: 'guided' | 'explorer') => {
      if (!user?.id || !profile || busy) return;
      const current = normalizeUiMode(profile);
      if (current === mode) return;

      const ui_mode_set_at = new Date().toISOString();
      const ui_mode: UIMode = mode === 'guided' ? 'guided' : 'explorer';
      const revertSnapshot = {
        ui_mode: profile.ui_mode,
        ui_mode_set_at: profile.ui_mode_set_at,
      } as Record<string, unknown>;
      setOptimisticMode(mode);
      mergeServerUserProfileRow({ ui_mode, ui_mode_set_at } as Record<string, unknown>);
      router.replace('/patient/home' as Href);

      setBusy(true);
      try {
        const { data: updated, error } = await supabase
          .from('user_profiles')
          .update({ ui_mode, ui_mode_set_at })
          .eq('auth_user_id', user.id)
          .select('*')
          .maybeSingle();

        if (error) {
          console.warn('[PatientHomeModeToggle] ui_mode update failed', error.message);
          setOptimisticMode(null);
          mergeServerUserProfileRow(revertSnapshot);
          return;
        }
        if (!updated) {
          console.warn('[PatientHomeModeToggle] ui_mode update returned no row (check RLS or auth_user_id match)');
          setOptimisticMode(null);
          mergeServerUserProfileRow(revertSnapshot);
          return;
        }

        mergeServerUserProfileRow(updated as Record<string, unknown>);
        setOptimisticMode(null);
      } finally {
        setBusy(false);
      }
    },
    [user?.id, profile, busy, router],
  );

  useEffect(() => {
    if (optimisticMode != null && optimisticMode === serverMode) {
      setOptimisticMode(null);
    }
  }, [optimisticMode, serverMode]);

  if (!profile) return null;

  return (
    <View style={styles.modeToggle}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: guidedSelected }}
        onPress={() => void applyMode('guided')}
        style={[styles.modeChip, guidedSelected ? styles.modeChipSelected : styles.modeChipIdle]}>
        <Text style={[styles.modeLabel, guidedSelected ? styles.modeLabelSelected : styles.modeLabelIdle]}>
          Guided
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: selfGuidedSelected }}
        onPress={() => void applyMode('explorer')}
        style={[styles.modeChip, selfGuidedSelected ? styles.modeChipSelected : styles.modeChipIdle]}>
        <Text style={[styles.modeLabel, selfGuidedSelected ? styles.modeLabelSelected : styles.modeLabelIdle]}>
          Self-Guided
        </Text>
      </Pressable>
    </View>
  );
}

const createStyles = (tokens: ReturnType<typeof useAppTheme>['tokens']) => StyleSheet.create({
  modeToggle: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  modeChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  modeChipSelected: {
    borderColor: tokens.colors.accent,
    backgroundColor: tokens.colors.accentSoft,
  },
  modeChipIdle: {
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  modeLabel: {
    fontFamily: 'Jost_300Light',
    fontSize: 14,
    letterSpacing: 0.6,
  },
  modeLabelSelected: {
    color: tokens.colors.text,
    fontWeight: '600',
  },
  modeLabelIdle: {
    color: tokens.colors.textCaption,
    fontWeight: '400',
  },
});
