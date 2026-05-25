import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  Image, ImageBackground, Keyboard, KeyboardAvoidingView,
  Platform, Pressable, StyleSheet, Text, TouchableWithoutFeedback, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type CoachBootstrap, PatientCoachPanel } from '@/components/patient/PatientCoachPanel';
import { LotusOrb } from '@/components/ui/LotusOrb';
import { SonaAmbientGlow } from '@/components/ui/SonaAmbientGlow';
import { useSonaVoice } from '@/contexts/SonaVoiceContext';
import { useAuth } from '@/hooks/useAuth';
import { useAppTheme } from '@/lib/theme/ThemeProvider';

const GOLD = '#BF8D36';

const ASSETS = {
  bgLight:   require('../../assets/images/sona-light-bg.png'),
  bgDark:    require('../../assets/images/sona-bg-dark.png'),
  logoLight: require('../../assets/images/sona-logo-light.png'),
  logoGold:  require('../../assets/images/sona-logo-gold.png'),
} as const;

// PART 5 — chips differ by patient type
const GLP1_CHIPS = [
  'Adjust my macros', 'My weight', 'Am I on track?',
  'InBody trends', 'My labs', 'Book an appointment', 'Make a payment',
] as const;

const NON_GLP_CHIPS = [
  'Adjust my macros', 'My weight', 'Am I on track?',
  'InBody trends', 'My labs', 'Log my workout',
] as const;

function QuickChips({ isDark, chips, onPress }: { isDark: boolean; chips: readonly string[]; onPress: (t: string) => void }) {
  const bg  = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.82)';
  const bdr = isDark ? 'rgba(191,141,54,0.38)'  : 'rgba(191,141,54,0.32)';
  const txt = isDark ? '#F4F1E8' : '#232426';
  return (
    <View style={cs.chipWrap}>
      {chips.map((chip) => (
        <Pressable key={chip} onPress={() => onPress(chip)}
          style={[cs.chip, { backgroundColor: bg, borderColor: bdr }]}>
          <Text style={[cs.chipTxt, { color: txt }]}>{chip}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function SonaTabScreen() {
  const insets = useSafeAreaInsets();
  const { resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';
  const { isListening } = useSonaVoice();
  const { profile } = useAuth();

  // PART 5 — route chips by patient type
  const isGlp1 = (profile as { consumer_tier?: string } | null)?.consumer_tier === 'glp1_plus'
    || profile?.role === 'clinic_patient';
  const CHIPS = isGlp1 ? GLP1_CHIPS : NON_GLP_CHIPS;

  const { prefill } = useLocalSearchParams<{ prefill?: string | string[] }>();
  const [coachBootstrap, setCoachBootstrap] = useState<CoachBootstrap | null>(null);
  const [conversationStarted, setConversationStarted] = useState(false);
  const [visualListening, setVisualListening]         = useState(false);
  const glowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fire this when mic is tapped — shows glow even if speech recognition
  // is unavailable (e.g. Expo Go simulator). Clears after 4 s if not listening.
  const handleMicTap = () => {
    setVisualListening(true);
    if (glowTimer.current) clearTimeout(glowTimer.current);
    glowTimer.current = setTimeout(() => setVisualListening(false), 4000);
  };

  // If real listening starts, keep glow active; when it stops, clear the timer.
  useEffect(() => {
    if (isListening) {
      if (glowTimer.current) clearTimeout(glowTimer.current);
      setVisualListening(true);
    } else {
      // Real listening ended — let the 4s timer run out naturally.
    }
  }, [isListening]);

  useEffect(() => {
    const raw = Array.isArray(prefill) ? prefill[0] : prefill;
    const t   = raw != null && String(raw).trim() ? String(raw).trim() : '';
    if (!t) return;
    setCoachBootstrap({ kind: 'text', text: t });
    setConversationStarted(true);
  }, [prefill]);

  const textPrimary = isDark ? '#F4F1E8' : '#232426';
  const textMuted   = isDark ? 'rgba(244,241,232,0.58)' : '#9a826a';

  return (
    <ImageBackground
      source={isDark ? ASSETS.bgDark : ASSETS.bgLight}
      style={ss.root}
      resizeMode="cover">

      {/* Tapping the header/orb area dismisses the keyboard so the tab bar becomes reachable */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View>
          {/* ── Header ───────────────────────────────────────────────── */}
          <View style={[ss.header, { paddingTop: 8 }]}>
            <Image
              source={isDark ? ASSETS.logoGold : ASSETS.logoLight}
              style={ss.logoImg}
              resizeMode="contain"
            />
            <Text style={[ss.logoSub, { color: textMuted }]}>AI COACH</Text>
          </View>

          {/* ── Orb — fixed, never scrolled ──────────────────────────── */}
          <View style={ss.orbSection}>
            <LotusOrb isListening={isListening || visualListening} isDark={isDark} size={200} />

            {!conversationStarted && (
              <>
                <Text style={[ss.emptyTitle, { color: textPrimary }]}>
                  What would you like help with?
                </Text>
                <QuickChips isDark={isDark} chips={CHIPS} onPress={(t) => {
                  setConversationStarted(true);
                  setCoachBootstrap({ kind: 'text', text: t });
                }} />
              </>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>

      {/* ── Chat + input, fills remaining space ────────────────────── */}
      <KeyboardAvoidingView
        style={ss.chatArea}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>
        <PatientCoachPanel
          sonaTab
          hideHeader
          suppressWeekly
          onMicTap={handleMicTap}
          coachBootstrap={coachBootstrap}
          onCoachBootstrapConsumed={() => setCoachBootstrap(null)}
        />
      </KeyboardAvoidingView>

      {/* ── Siri edge glow — visible on mic tap even without speech API ─ */}
      <SonaAmbientGlow visible={isListening || visualListening} />

    </ImageBackground>
  );
}

const ss = StyleSheet.create({
  root: { flex: 1 },

  header: { alignItems: 'center', paddingBottom: 2 },
  logoImg: { width: 86, height: 48 },
  logoSub: { fontFamily: 'DMSans_400Regular', fontSize: 11, letterSpacing: 2.5, marginTop: 2 },

  // Orb section sits between header and chat; no flex so it takes natural height
  orbSection: { alignItems: 'center', paddingTop: 8, paddingBottom: 4, gap: 12 },

  emptyTitle: {
    fontFamily: 'PTSerif_400Regular',
    fontSize: 20, textAlign: 'center', paddingHorizontal: 24,
  },

  // Chat area fills all remaining space — input naturally rests at bottom
  chatArea: { flex: 1 },
});

const cs = StyleSheet.create({
  chipWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 16, justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: 13, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1,
    shadowColor: '#3d2b1a', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10, shadowRadius: 6, elevation: 3,
  },
  chipTxt: { fontFamily: 'DMSans_400Regular', fontSize: 12 },
});

