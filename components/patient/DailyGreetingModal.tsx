import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { User } from '@supabase/supabase-js';

import { Button } from '@/components/ui/Button';
import { pickMoodResponse } from '@/lib/moodResponses';
import { useAppTheme } from '@/lib/theme/ThemeProvider';
import type { UserProfile } from '@/types/user';

const MOOD_PRESETS = [
  'Feeling great 💪',
  'Pretty good',
  'So-so',
  'Rough day',
  'Exhausted',
  'Anxious',
] as const;

type Phase = 'pick' | 'thinking' | 'coach';

type Props = {
  visible: boolean;
  profile: UserProfile | null;
  user: User | null;
  firstName: string;
  paddingTop: number;
  paddingBottom: number;
  onDismiss: () => void | Promise<void>;
};

export function DailyGreetingModal({
  visible,
  profile,
  user,
  firstName,
  paddingTop,
  paddingBottom,
  onDismiss,
}: Props) {
  const { tokens } = useAppTheme();
  const styles = createStyles(tokens);
  const [phase, setPhase] = useState<Phase>('pick');
  const [feelingNote, setFeelingNote] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [coachReply, setCoachReply] = useState('');
  const coachFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    setPhase('pick');
    setFeelingNote('');
    setSelectedPreset(null);
    setCoachReply('');
    coachFade.setValue(0);
  }, [visible, coachFade]);

  useEffect(() => {
    if (phase !== 'coach') return;
    coachFade.setValue(0);
    Animated.timing(coachFade, { toValue: 1, duration: 380, useNativeDriver: true }).start();
  }, [phase, coachFade]);

  const moodToId = (label: string): 'great' | 'good' | 'okay' | 'tired' | 'anxious' => {
    const lower = label.toLowerCase();
    if (lower.includes('great')) return 'great';
    if (lower.includes('good')) return 'good';
    if (lower.includes('rough') || lower.includes('exhausted') || lower.includes('tired')) return 'tired';
    if (lower.includes('anxious')) return 'anxious';
    return 'okay';
  };

  const runAcknowledgment = (moodLabel: string, optionalNote: string) => {
    const mood = moodToId(moodLabel);
    const base = pickMoodResponse(mood);
    const notePrefix = optionalNote.trim() ? `${firstName.trim() || 'there'}, thanks for sharing that. ` : '';
    setCoachReply(`${notePrefix}${base}`);
    setPhase('coach');
  };

  const onSubmitCheckIn = () => {
    const note = feelingNote.trim();
    const preset = selectedPreset;
    let moodLabel: string;
    let optionalNote: string;
    if (preset) {
      moodLabel = preset;
      optionalNote = note;
    } else if (note) {
      moodLabel = note.length > 120 ? `${note.slice(0, 117)}…` : note;
      optionalNote = '';
    } else {
      return;
    }
    runAcknowledgment(moodLabel, optionalNote);
  };

  const onPickPreset = (label: string) => {
    setSelectedPreset(label);
    const note = feelingNote.trim();
    runAcknowledgment(label, note);
  };

  const canSubmit = Boolean(selectedPreset || feelingNote.trim());

  const finishToDashboard = () => {
    void (async () => {
      await onDismiss();
    })();
  };

  if (!profile || !user) return null;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen">
      <KeyboardAvoidingView
        style={[styles.shell, { paddingTop, paddingBottom }]}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        {phase === 'pick' ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.pickScroll}
            showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>
              {timeOfDayGreeting()}, {firstName} — how are you feeling today?
            </Text>
            <Text style={styles.hint}>Tap a mood or write a few words. Sona answers instantly before you head in.</Text>

            <Text style={styles.sectionLabel}>Quick mood</Text>
            <View style={styles.moodGrid}>
              {MOOD_PRESETS.map((label) => {
                const on = selectedPreset === label;
                return (
                  <Pressable
                    key={label}
                    onPress={() => onPickPreset(label)}
                    style={[styles.moodChip, on ? styles.moodChipOn : styles.moodChipOff]}>
                    <Text style={[styles.moodChipText, on ? styles.moodChipTextOn : styles.moodChipTextOff]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Anything else on your mind? (optional)</Text>
            <TextInput
              value={feelingNote}
              onChangeText={setFeelingNote}
              placeholder="A sentence or two is perfect…"
              placeholderTextColor={tokens.colors.textCaption}
              style={styles.input}
              multiline
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
            />

            <View style={styles.row}>
              <Button variant="ghost" onPress={() => void finishToDashboard()}>
                Skip for now
              </Button>
              <Button variant="primary" disabled={!canSubmit} onPress={onSubmitCheckIn}>
                Share with Sona
              </Button>
            </View>
          </ScrollView>
        ) : null}

        {phase === 'thinking' ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="large" color={tokens.colors.accent} />
            <Text style={styles.thinking}>Sona is reflecting on what you shared…</Text>
          </View>
        ) : null}

        {phase === 'coach' ? (
          <Animated.View style={[styles.coachBlock, { opacity: coachFade }]}>
            <Text style={styles.coachLabel}>Sona</Text>
            <Text style={styles.coachBody}>{coachReply}</Text>
            <Button variant="primary" onPress={() => void finishToDashboard()}>
              Into my day
            </Button>
          </Animated.View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function timeOfDayGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 22) return 'Good evening';
  if (h >= 22 || h < 5) return 'Good evening';
  return 'Hello';
}

const createStyles = (tokens: ReturnType<typeof useAppTheme>['tokens']) => StyleSheet.create({
  shell: {
    flex: 1,
    width: '100%',
    backgroundColor: tokens.colors.background,
    paddingHorizontal: tokens.spacing.pageX,
  },
  pickScroll: {
    paddingBottom: tokens.spacing.lg,
    flexGrow: 1,
    justifyContent: 'center',
  },
  title: {
    ...tokens.typography.h1,
    color: tokens.colors.text,
    marginBottom: tokens.spacing.sm,
  },
  hint: {
    ...tokens.typography.body,
    color: tokens.colors.textMuted,
    marginBottom: tokens.spacing.lg,
    lineHeight: 22,
  },
  sectionLabel: {
    ...tokens.typography.label,
    color: tokens.colors.accent,
    letterSpacing: 1.2,
    marginBottom: tokens.spacing.sm,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  moodChip: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    minWidth: '47%',
    flexGrow: 1,
  },
  moodChipOn: {
    borderColor: tokens.colors.accent,
    backgroundColor: tokens.colors.accentSoft,
  },
  moodChipOff: {
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  moodChipText: {
    ...tokens.typography.secondary,
    fontSize: 15,
    textAlign: 'center',
  },
  moodChipTextOn: {
    color: tokens.colors.text,
  },
  moodChipTextOff: {
    color: tokens.colors.textMuted,
  },
  input: {
    ...tokens.typography.body,
    color: tokens.colors.text,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    padding: 14,
    minHeight: 96,
    textAlignVertical: 'top',
    marginBottom: tokens.spacing.lg,
    backgroundColor: tokens.colors.surface,
  },
  row: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  centerBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 12,
  },
  thinking: {
    ...tokens.typography.body,
    color: tokens.colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  coachBlock: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 4,
  },
  coachLabel: {
    ...tokens.typography.label,
    color: tokens.colors.accent,
    letterSpacing: 2,
  },
  coachBody: {
    ...tokens.typography.body,
    color: tokens.colors.text,
    fontSize: 18,
    lineHeight: 28,
  },
});
