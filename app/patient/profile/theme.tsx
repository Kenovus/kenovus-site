import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { useAppTheme } from '@/lib/theme/ThemeProvider';
import type { ThemeMode } from '@/lib/theme/tokens';

const OPTIONS: Array<{ id: ThemeMode; label: string }> = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'auto', label: 'Auto (follows device appearance)' },
];

export default function ThemeSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tokens, themeMode, setThemeMode } = useAppTheme();
  const styles = createStyles(tokens);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + tokens.spacing.pageTop, paddingBottom: insets.bottom + tokens.spacing.pageBottom }]}>
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Theme</Text>
      <Text style={styles.helper}>
        Choose Light, Dark, or Auto. Auto matches your device appearance and may shift through the day.
      </Text>
      <View style={styles.group}>
        {OPTIONS.map((o) => {
          const selected = themeMode === o.id;
          return (
            <Pressable
              key={o.id}
              onPress={() => {
                setThemeMode(o.id);
              }}
              style={[styles.option, selected && styles.optionOn]}>
              <Text style={[styles.optionText, selected && styles.optionTextOn]}>{o.label}</Text>
              {selected ? (
                <Ionicons name="checkmark-circle" size={22} color={tokens.colors.accent} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <Button variant="ghost" onPress={() => void setThemeMode('auto')}>
        Reset to Auto
      </Button>
    </View>
  );
}

const createStyles = (tokens: ReturnType<typeof useAppTheme>['tokens']) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: tokens.colors.background,
      paddingHorizontal: tokens.spacing.pageX,
      gap: tokens.spacing.md,
    },
    backBtn: { alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 4 },
    backText: { ...tokens.typography.body, color: tokens.colors.accent, fontSize: 16 },
    title: { ...tokens.typography.h2, color: tokens.colors.text },
    helper: { ...tokens.typography.secondary, color: tokens.colors.textMuted },
    group: { gap: tokens.spacing.sm, marginTop: tokens.spacing.sm, marginBottom: tokens.spacing.md },
    option: {
      minHeight: 52,
      borderRadius: tokens.radius.md,
      borderWidth: 1,
      borderColor: tokens.colors.border,
      backgroundColor: tokens.colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
    },
    optionOn: { borderColor: tokens.colors.accent, backgroundColor: tokens.colors.accentSoft },
    optionText: { ...tokens.typography.body, color: tokens.colors.textMuted },
    optionTextOn: { color: tokens.colors.text, fontWeight: '600' },
  });
