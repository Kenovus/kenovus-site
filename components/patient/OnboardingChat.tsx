import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatBubble } from '@/components/ai/ChatBubble';
import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useOnboardingChat } from '@/hooks/useOnboardingChat';
import type { OnboardingConversationAnswers } from '@/types/onboarding';

type Props = {
  onSkip: () => void;
  onContinue: (answers: OnboardingConversationAnswers) => void;
  continueLoading?: boolean;
};

export function OnboardingChat({ onSkip, onContinue, continueLoading }: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const {
    messages,
    progress,
    chips,
    showTextComposer,
    showGlp1Form,
    submitGlp1Detail,
    submitFreeText,
    phase,
    completionAnswers,
  } = useOnboardingChat();

  const [draft, setDraft] = useState('');
  const [glpMed, setGlpMed] = useState('');
  const [glpDose, setGlpDose] = useState('');

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages.length, phase]);

  const sendDraft = () => {
    const t = draft.trim();
    if (!t) return;
    submitFreeText(t);
    setDraft('');
  };

  const onVoice = () => {
    Alert.alert('Voice input', 'Speech capture ships with Expo Speech in a later pass.');
  };

  const submitGlp = () => {
    submitGlp1Detail(glpMed, glpDose);
    setGlpMed('');
    setGlpDose('');
  };

  const showContinue = phase.kind === 'done' && !!completionAnswers;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.progressRow}>
        <Text style={styles.progressLabel}>
          Step {progress.step} of {progress.totalSteps}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress.turnFraction * 100}%` }]} />
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {messages.map((m) => (
          <ChatBubble key={m.id} role={m.role}>
            {m.text}
          </ChatBubble>
        ))}
      </ScrollView>

      {showGlp1Form ? (
        <View style={styles.glpBox}>
          <Text style={styles.glpLabel}>Medication</Text>
          <TextInput
            onChangeText={setGlpMed}
            placeholder="e.g. Zepbound"
            placeholderTextColor={colors.gray2}
            style={styles.input}
            value={glpMed}
          />
          <Text style={[styles.glpLabel, styles.glpSpaced]}>Dose</Text>
          <TextInput
            onChangeText={setGlpDose}
            placeholder="e.g. 5 mg"
            placeholderTextColor={colors.gray2}
            style={styles.input}
            value={glpDose}
          />
          <Button onPress={submitGlp} style={styles.glpBtn} variant="primary">
            Continue
          </Button>
        </View>
      ) : null}

      {chips.length > 0 ? (
        <View style={styles.chips}>
          <Text style={styles.or}>Quick options</Text>
          <View style={styles.chipWrap}>
            {chips.map((c) => (
              <Pressable
                key={c.label}
                onPress={c.onPress}
                style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}>
                <Text style={styles.chipText}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {showTextComposer ? (
        <View>
          <Text style={styles.or}>Or type</Text>
          <View style={styles.composerRow}>
            <TextInput
              multiline
              onChangeText={setDraft}
              onSubmitEditing={sendDraft}
              placeholder="Your answer"
              placeholderTextColor={colors.gray2}
              style={styles.composerInput}
              value={draft}
            />
            <Pressable accessibilityLabel="Voice input" onPress={onVoice} style={styles.mic}>
              <Ionicons color={colors.gold} name="mic-outline" size={26} />
            </Pressable>
          </View>
          <Button onPress={sendDraft} style={styles.sendBtn} variant="ghost">
            Send
          </Button>
        </View>
      ) : null}

      {showContinue ? (
        <Button
          loading={continueLoading}
          onPress={() => completionAnswers && onContinue(completionAnswers)}
          style={styles.continueBtn}
          variant="primary"
          disabled={!completionAnswers}>
          Continue to profile
        </Button>
      ) : null}

      <Pressable disabled={phase.kind === 'done'} hitSlop={12} onPress={onSkip} style={styles.skip}>
        <Text style={styles.skipText}>Skip conversation</Text>
      </Pressable>

      <View style={{ height: insets.bottom + 8 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
    paddingHorizontal: 16,
  },
  progressRow: {
    marginBottom: 12,
  },
  progressLabel: {
    ...typography.label,
    color: colors.gold,
    marginBottom: 8,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.darkCard,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.gold,
  },
  scrollContent: {
    paddingBottom: 12,
    flexGrow: 1,
  },
  chips: {
    marginTop: 4,
  },
  or: {
    ...typography.body,
    color: colors.gray2,
    marginBottom: 10,
    fontSize: 12,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: colors.darkCard,
  },
  chipPressed: {
    opacity: 0.85,
  },
  chipText: {
    ...typography.body,
    color: colors.white,
    fontSize: 14,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  composerInput: {
    flex: 1,
    ...typography.body,
    color: colors.white,
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: colors.dark2,
  },
  mic: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkCard,
  },
  sendBtn: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  glpBox: {
    marginTop: 8,
    marginBottom: 8,
  },
  glpLabel: {
    ...typography.label,
    color: colors.gold,
    marginBottom: 6,
  },
  glpSpaced: {
    marginTop: 12,
  },
  input: {
    ...typography.body,
    color: colors.white,
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.dark2,
  },
  glpBtn: {
    marginTop: 16,
  },
  continueBtn: {
    marginTop: 12,
  },
  skip: {
    alignSelf: 'center',
    marginTop: 14,
    paddingVertical: 8,
  },
  skipText: {
    ...typography.body,
    color: colors.gray2,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
});
