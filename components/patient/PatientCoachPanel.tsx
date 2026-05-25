import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { useFocusEffect } from 'expo-router';
import { getExpoPublic } from '@/lib/expoPublicEnv';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ChatBubble } from '@/components/ai/ChatBubble';
import { EmergencyOverlay } from '@/components/ui/EmergencyOverlay';
import { LotusOrb } from '@/components/ui/LotusOrb';
import { SonaVoiceButton, type SonaVoiceVisualState } from '@/components/ui/SonaVoiceButton';
import { useSonaVoice } from '@/contexts/SonaVoiceContext';
import { useAI } from '@/hooks/useAI';
import { useAuth } from '@/hooks/useAuth';
import { useWeeklyNarrative } from '@/hooks/useWeeklyNarrative';
import { speakCoachReply, stopSpeaking } from '@/lib/elevenlabsTts';
import {
  ExpoSpeechRecognitionModule,
  hasSpeechRecognition,
  useSpeechRecognitionEvent,
} from '@/lib/safeSpeechRecognition';
import { isSupabaseConfigured } from '@/lib/supabase';
import { standardTextInputProps } from '@/lib/textInputStandard';
import { useAppTheme } from '@/lib/theme/ThemeProvider';

export type CoachBootstrap = { kind: 'blank' | 'text'; text: string };

type Props = {
  /** Quick chips rendered directly under the ask field */
  chipRow?: ReactNode;
  /** Rendered at the top of the chat scroll — orb, chips, etc. */
  topContent?: ReactNode;
  /** One-shot: prefill the ask field (from deep links / home chips). */
  coachBootstrap?: CoachBootstrap | null;
  onCoachBootstrapConsumed?: () => void;
  /** Full Sona tab: voice modal, weekly behind “View summary,” bottom voice control. */
  sonaTab?: boolean;
  /** Suppress the built-in Sona/Ask header so the parent can render its own. */
  hideHeader?: boolean;
  /** Suppress the weekly narrative card/CTA (parent handles it via insight card). */
  suppressWeekly?: boolean;
  /** Fired whenever the mic button is tapped — even if speech recognition unavailable. */
  onMicTap?: () => void;
};

export function PatientCoachPanel({
  chipRow,
  topContent,
  coachBootstrap,
  onCoachBootstrapConsumed,
  sonaTab = false,
  hideHeader = false,
  suppressWeekly = false,
  onMicTap,
}: Props) {
  const { tokens } = useAppTheme();
  const styles = createStyles(tokens);
  const { profile } = useAuth();
  const { messages, loading, send, coachDailyUsage, emergencyVisible, dismissEmergency, callEmergency } = useAI();
  const weekly = useWeeklyNarrative();
  const {
    isListening,
    currentTranscript,
    startListening: startVoice,
    stopListening: stopVoice,
    handleTranscriptFinal,
    registerSendToAI,
  } = useSonaVoice();
  const [recordingUnavailable, setRecordingUnavailable] = useState(false);
  const [autoReadAloud, setAutoReadAloud] = useState(true);
  /** Only auto-play TTS for replies to messages sent via voice, not typed text. */
  const [lastInputWasVoice, setLastInputWasVoice] = useState(false);
  const [isSpeakingAloud, setIsSpeakingAloud] = useState(false);
  const [showCoachTip, setShowCoachTip] = useState(false);
  const [weeklyExpanded, setWeeklyExpanded] = useState(false);
  const [weeklyUserOpened, setWeeklyUserOpened] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const draftRef = useRef('');
  const lastAutoSpokenIdRef = useRef<string | null>(null);
  const micTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setDraftText = useCallback((text: string) => {
    draftRef.current = text;
    inputRef.current?.setNativeProps({ text });
  }, []);

  useEffect(() => {
    if (!coachBootstrap) return;
    setDraftText(coachBootstrap.kind === 'text' ? coachBootstrap.text : '');
    onCoachBootstrapConsumed?.();
  }, [coachBootstrap, onCoachBootstrapConsumed, setDraftText]);

  const onDraftChange = useCallback((text: string) => {
    draftRef.current = text;
  }, []);

  const sendVoiceToAI = useCallback(
    (transcript: string) => {
      setLastInputWasVoice(true);
      setDraftText('');
      void send(transcript);
    },
    [send, setDraftText],
  );

  useEffect(() => {
    registerSendToAI(sendVoiceToAI);
    return () => registerSendToAI(undefined);
  }, [registerSendToAI, sendVoiceToAI]);

  useFocusEffect(
    useCallback(() => {
      // Initialise audio session so mic works every time we enter this screen
      void Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      void (async () => {
        const v = await AsyncStorage.getItem('sona.voice.autoSpeak');
        setAutoReadAloud(v == null ? true : v === '1');
      })();
      void (async () => {
        const key = 'sona.coach.tip.seen.v1';
        const seen = await AsyncStorage.getItem(key);
        if (!seen) {
          setShowCoachTip(true);
          await AsyncStorage.setItem(key, '1');
        }
      })();

      return () => {
        // Release audio session and stop any active recognition when leaving
        void Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: false,
        });
        if (ExpoSpeechRecognitionModule) {
          try { ExpoSpeechRecognitionModule.stop(); } catch { /* ignore */ }
        }
        if (sonaTab) {
          setVoiceModalOpen(false);
        }
      };
    }, [sonaTab]),
  );

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length, loading]);

  const playReplyAloud = useCallback(async (text: string) => {
    const responseText = text.trim();
    if (!responseText) return;
    // Use getExpoPublic so the key is found even when Metro cache is stale
    const elevenLabsApiKey = getExpoPublic('EXPO_PUBLIC_ELEVENLABS_API_KEY');
    if (!elevenLabsApiKey) {
      console.warn('[Sona] Missing EXPO_PUBLIC_ELEVENLABS_API_KEY; skipping voice playback.');
      return;
    }
    setIsSpeakingAloud(true);
    try {
      const r = await speakCoachReply(responseText);
      if (!r.ok && r.reason === 'expo_go') Alert.alert('Voice output', 'Voice output available in full app.');
    } finally {
      setIsSpeakingAloud(false);
    }
  }, []);

  // TTS fires ONLY for voice-input replies, NOT typed messages
  useEffect(() => {
    if (!autoReadAloud || !lastInputWasVoice) return;
    if (loading) return; // wait for streaming to finish
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant') return;
    if (!last.text || last.text.length < 10) return;
    if (lastAutoSpokenIdRef.current === last.id) return;
    lastAutoSpokenIdRef.current = last.id;
    void playReplyAloud(last.text);
    setLastInputWasVoice(false);
  }, [loading, messages, autoReadAloud, lastInputWasVoice, playReplyAloud]);

  useEffect(() => {
    if (!currentTranscript) return;
    setDraftText(currentTranscript);
  }, [currentTranscript, setDraftText]);

  useSpeechRecognitionEvent('result', (event) => {
    const best = event.results?.[0]?.transcript;
    if (best) {
      // Cancel timeout — speech is coming in
      if (micTimeoutRef.current) { clearTimeout(micTimeoutRef.current); micTimeoutRef.current = null; }
      setDraftText(best);
    }
  });

  useSpeechRecognitionEvent('start', () => {
    setRecordingUnavailable(false);
  });

  useSpeechRecognitionEvent('error', () => {
    if (micTimeoutRef.current) { clearTimeout(micTimeoutRef.current); micTimeoutRef.current = null; }
    setRecordingUnavailable(true);
    stopVoice();
  });

  useSpeechRecognitionEvent('end', () => {
    if (micTimeoutRef.current) { clearTimeout(micTimeoutRef.current); micTimeoutRef.current = null; }
    const t = draftRef.current.trim();
    if (!t) {
      stopVoice();
      return;
    }
    void handleTranscriptFinal(t);
  });

  const onSend = async () => {
    const t = draftRef.current.trim();
    if (!t || loading) return;
    setDraftText('');
    setLastInputWasVoice(false);
    Keyboard.dismiss();
    await send(t);
  };

  const ensureSpeechReady = useCallback(async (): Promise<boolean> => {
    // Silently fail if speech recognition is unavailable — no blocking alerts
    if (recordingUnavailable) return false;
    if (!hasSpeechRecognition || !ExpoSpeechRecognitionModule) {
      setRecordingUnavailable(true);
      return false;
    }
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setRecordingUnavailable(true);
      return false;
    }
    const perms = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perms.granted) {
      Alert.alert('Microphone permission needed', 'Please allow microphone access in Settings to use voice.');
      return false;
    }
    return true;
  }, [recordingUnavailable]);

  const launchListening = useCallback(async () => {
    if (!(await ensureSpeechReady())) return;
    if (sonaTab) {
      setVoiceModalOpen(true);
    }
    // 5-second hard timeout — silently returns to idle if nothing is heard
    if (micTimeoutRef.current) clearTimeout(micTimeoutRef.current);
    micTimeoutRef.current = setTimeout(() => {
      stopVoice();
      setDraftText('');
    }, 5_000);
    await startVoice();
  }, [ensureSpeechReady, sonaTab, startVoice, stopVoice, setDraftText]);

  const toggleSonaVoice = useCallback(async () => {
    if (isListening) {
      stopVoice();
      return;
    }
    if (voiceModalOpen) {
      setVoiceModalOpen(false);
      return;
    }
    await launchListening();
  }, [isListening, voiceModalOpen, launchListening, stopVoice]);

  const toggleMic = useCallback(async () => {
    if (isListening) {
      stopVoice();
      return;
    }
    await launchListening();
  }, [isListening, launchListening, stopVoice]);

  const stopListening = useCallback(() => {
    stopVoice();
    setVoiceModalOpen(false);
  }, [stopVoice]);

  const inputAccessory = standardTextInputProps({ multiline: true, onSubmit: onSend });

  let sonaVoiceState: SonaVoiceVisualState = 'inactive';
  if (loading) {
    sonaVoiceState = 'thinking';
  } else if (isListening) {
    sonaVoiceState = 'listening';
  }

  const lastAssistant = messages.filter((m) => m.role === 'assistant').at(-1)?.text;

  let modalStatusLine = 'Got it…';
  if (isListening) {
    modalStatusLine = draftRef.current.trim() ? draftRef.current : 'Listening…';
  } else if (loading) {
    modalStatusLine = 'Thinking…';
  } else if (lastAssistant) {
    modalStatusLine = `Sona: ${lastAssistant}`;
  }

  const modalHeroState: SonaVoiceVisualState = isListening ? 'listening' : loading ? 'thinking' : 'inactive';

  return (
    <View style={sonaTab ? styles.sonaPanel : styles.panel}>
      {!hideHeader && (
        <View style={styles.askHeader}>
          <Text style={styles.sparkleLabel}>{sonaTab ? 'Sona' : '✨ Ask Sona'}</Text>
          {sonaTab ? (
            <Text style={styles.disclaimer}>Your guide for habits, food, and training</Text>
          ) : null}
          <Text style={styles.disclaimer}>Not medical advice · Contact your provider for clinical decisions</Text>
          {profile?.role === 'consumer' && coachDailyUsage ? (
            <Text style={styles.usage}>
              Messages today: {coachDailyUsage.used} / {coachDailyUsage.cap}
            </Text>
          ) : null}
        </View>
      )}

      {!suppressWeekly && sonaTab && weekly.text && !weeklyUserOpened ? (
        <Pressable
          onPress={() => {
            setWeeklyUserOpened(true);
            setWeeklyExpanded(true);
          }}
          style={styles.weeklyCta}>
          <Text style={styles.weeklyCtaText}>View summary</Text>
        </Pressable>
      ) : null}
      {!suppressWeekly && sonaTab && weeklyUserOpened && weekly.text ? (
        <View style={styles.weeklyCard}>
          <Text style={styles.weeklyTitle}>This week&apos;s summary</Text>
          <Text style={styles.weeklyBody} numberOfLines={weeklyExpanded ? undefined : 2}>
            {weekly.text}
          </Text>
          <Pressable onPress={() => setWeeklyExpanded((v) => !v)}>
            <Text style={styles.readMore}>{weeklyExpanded ? 'Show less' : 'Read more'}</Text>
          </Pressable>
        </View>
      ) : !suppressWeekly && !sonaTab && weekly.text ? (
        <View style={styles.weeklyCard}>
          <Text style={styles.weeklyTitle}>This week&apos;s summary</Text>
          <Text style={styles.weeklyBody} numberOfLines={weeklyExpanded ? undefined : 2}>
            {weekly.text}
          </Text>
          <Pressable onPress={() => setWeeklyExpanded((v) => !v)}>
            <Text style={styles.readMore}>{weeklyExpanded ? 'Show less' : 'Read more'}</Text>
          </Pressable>
        </View>
      ) : weekly.loading && !sonaTab ? (
        <Text style={styles.weeklyLoading}>Loading your weekly summary…</Text>
      ) : null}

      {chipRow && messages.length === 0 ? <View style={styles.chipSlot}>{chipRow}</View> : null}

      {showCoachTip && !sonaTab ? (
        <Pressable onPress={() => setShowCoachTip(false)} style={styles.tipCard}>
          <Text style={styles.tipText}>
            💡 Tip: You can tell Sona anything — meals, workouts, how you feel. Try a meal line or a workout log.
          </Text>
        </Pressable>
      ) : null}

      {!isSupabaseConfigured ? (
        <Text style={styles.warn}>Supabase is not configured. Chat works, but profile sync is limited.</Text>
      ) : null}

      {loading ? <Text style={styles.typing}>Sona is thinking…</Text> : null}
      {isSpeakingAloud ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 2 }}>
          <Text style={styles.typing}>Sona is speaking…</Text>
          <Pressable
            onPress={() => { void stopSpeaking(); setIsSpeakingAloud(false); }}
            style={{ backgroundColor: 'rgba(191,141,54,0.18)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(191,141,54,0.40)' }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#BF8D36' }}>■ Stop</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={sonaTab ? styles.sonaChatScroll : styles.chatScroll}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {sonaTab && topContent ? (
          <View style={{ paddingBottom: 8 }}>{topContent}</View>
        ) : null}
        {messages.slice(-12).map((m) =>
          m.role === 'assistant' ? (
            <ChatBubble
              key={m.id}
              role="assistant"
              footer={
                <Pressable
                  onPress={() => void playReplyAloud(m.text)}
                  accessibilityRole="button"
                  accessibilityLabel="Read response aloud"
                  hitSlop={8}
                  style={styles.speakerBtn}>
                  <Ionicons name="volume-medium-outline" size={20} color={tokens.colors.accent} />
                </Pressable>
              }>
              {m.text}
            </ChatBubble>
          ) : (
            <ChatBubble key={m.id} role="user">
              {m.text}
            </ChatBubble>
          ),
        )}
      </ScrollView>

      <View style={sonaTab ? styles.sonaInputCol : undefined}>
        <View style={styles.askRow}>
          <TextInput
            ref={inputRef}
            defaultValue=""
            onChangeText={onDraftChange}
            placeholder={sonaTab ? 'Ask Sona anything…' : 'Ask Sona…'}
            placeholderTextColor={tokens.colors.textCaption}
            style={styles.askInput}
            multiline
            {...inputAccessory}
            autoCorrect={false}
            spellCheck={false}
            blurOnSubmit={false}
          />
          <Pressable
            onPress={() => { onMicTap?.(); void toggleMic(); }}
            style={[styles.mic, isListening && styles.micOn, (!hasSpeechRecognition || recordingUnavailable) && styles.micOff]}>
            <Ionicons name="mic-outline" size={22} color={tokens.colors.accent} />
          </Pressable>
          <Pressable onPress={() => void onSend()} style={[styles.sendCircle, loading && styles.sendDisabled]}>
            <Text style={styles.sendCircleText}>↑</Text>
          </Pressable>
        </View>
      </View>

      <Pressable style={styles.doneKb} onPress={() => Keyboard.dismiss()}>
        <Text style={styles.doneKbText}>Done</Text>
      </Pressable>

      {/* Voice overlay removed — voice input inline in the input bar */}

      <EmergencyOverlay
        visible={emergencyVisible}
        onCall911={() => void callEmergency()}
        onDismiss={() => void dismissEmergency()}
      />
    </View>
  );
}

const createStyles = (tokens: ReturnType<typeof useAppTheme>['tokens']) => {
  const colors = {
    dark2: tokens.colors.backgroundElevated,
    darkCard: tokens.colors.surface,
    gold: tokens.colors.accent,
    goldDim: tokens.colors.border,
    white: tokens.colors.text,
    gray1: tokens.colors.textMuted,
    gray2: tokens.colors.textCaption,
    warning: tokens.colors.warning,
  };
  const typography = {
    h2: tokens.typography.h2,
    body: tokens.typography.body,
    label: tokens.typography.label,
  };
  return StyleSheet.create({
    panel: { marginBottom: 16 },
    sonaPanel: { flex: 1 },
    askHeader: { marginBottom: 8 },
    sparkleLabel: { ...typography.h2, color: colors.white },
    disclaimer: { ...typography.body, color: colors.gray2, fontSize: 15, marginTop: 4 },
    usage: { ...typography.body, color: colors.gray1, fontSize: 15, marginTop: 4 },
    askRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginBottom: 8 },
    askInput: {
      flex: 1,
      minHeight: 50,
      borderWidth: 1,
      borderColor: colors.goldDim,
      borderRadius: 16,
      backgroundColor: tokens.colors.backgroundElevated + 'E8',
      color: colors.white,
      paddingHorizontal: 16,
      paddingVertical: 12,
      maxHeight: 120,
      ...typography.body,
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
    micOn: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.2)' },
    micOff: { opacity: 0.6 },
    sendCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.goldDim,
      backgroundColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendCircleText: { ...typography.h2, color: '#241B0A' },
    sendDisabled: { opacity: 0.65 },
    chipSlot: { marginBottom: 12 },
    weeklyCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.goldDim,
      backgroundColor: tokens.colors.surface + 'CC',
      padding: 12,
      marginBottom: 12,
    },
    weeklyTitle: { ...typography.label, color: colors.gold, marginBottom: 8 },
    weeklyBody: { ...typography.body, color: colors.gray1, fontSize: 15, lineHeight: 22 },
    readMore: { ...typography.body, color: colors.gold, marginTop: 8, textDecorationLine: 'underline' },
    weeklyLoading: { ...typography.body, color: colors.gray2, marginBottom: 8, fontSize: 15 },
    typing: { ...typography.body, color: colors.gold, fontSize: 15, marginBottom: 8 },
    chatScroll: { maxHeight: 280 },
    sonaChatScroll: { flex: 1 },
    sonaInputCol: { paddingBottom: 8 },
    sonaVoiceRow: { alignItems: 'center', justifyContent: 'center', paddingTop: 8, paddingBottom: 4 },
    weeklyCta: {
      alignSelf: 'center',
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.gold,
      backgroundColor: 'rgba(201,168,76,0.12)',
      marginBottom: 12,
    },
    weeklyCtaText: { ...typography.label, color: colors.gold },
    voiceFullScreen: { flex: 1, alignItems: 'center', backgroundColor: '#F5EDE4' },
    voiceBg: { position: 'absolute', top: 0, right: 0, width: '100%', height: '100%' },
    voiceOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(245,238,228,0.3)',
    },
    voiceHeader: { marginTop: 80, alignItems: 'center', marginBottom: 8 },
    voiceLogoImg: { width: 110, height: 110, backgroundColor: 'transparent' },
    voiceHeaderSub: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#9a826a', letterSpacing: 2, marginTop: 4 },
    voiceTitle: {
      fontFamily: 'PTSerif_400Regular',
      fontSize: 32,
      color: '#1a1008',
      marginTop: 24,
      letterSpacing: 0.5,
    },
    voiceSubtitle: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#9a826a', marginTop: 6, marginBottom: 32 },
    voiceOrbWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    voiceCap: {
      fontFamily: 'DMSans_400Regular',
      fontSize: 15,
      color: '#2a1e10',
      textAlign: 'center',
      paddingHorizontal: 32,
      marginBottom: 32,
      lineHeight: 22,
    },
    voiceStopBtn: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: 'rgba(180,155,120,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      borderWidth: 1,
      borderColor: 'rgba(180,140,40,0.4)',
    },
    voiceStopTxt: { fontSize: 14, color: '#2a1e10' },
    voiceTypeBtn: {
      backgroundColor: 'rgba(255,255,255,0.8)',
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 28,
      borderWidth: 1,
      borderColor: 'rgba(180,155,120,0.35)',
      marginBottom: 20,
    },
    voiceTypeTxt: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#2a1e10' },
    voiceTips: {
      fontFamily: 'DMSans_400Regular',
      fontSize: 11,
      color: '#9a826a',
      textAlign: 'center',
      paddingHorizontal: 40,
      lineHeight: 18,
    },
    voiceDim: { flex: 1 },
    tipCard: {
      borderWidth: 1,
      borderColor: colors.goldDim,
      borderRadius: 12,
      backgroundColor: colors.darkCard,
      padding: 12,
      marginBottom: 12,
    },
    tipText: { ...typography.body, color: colors.gray1 },
    warn: { ...typography.body, color: colors.warning, fontSize: 15, marginBottom: 8 },
    speakerBtn: { padding: 8 },
    doneKb: { alignSelf: 'flex-end', paddingVertical: 8 },
    doneKbText: { ...typography.body, color: colors.gold },
  });
};
