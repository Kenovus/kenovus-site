/**
 * Post-Treatment Check-In
 * Triggered 24/48/72 hrs after an aesthetic procedure at Sona.
 * Symptom sliders, recovery notes, photo upload, and contact button.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Alert, Animated, ImageBackground, Linking, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { useAppTheme } from '@/lib/theme/ThemeProvider';

const GOLD  = '#BF8D36';
const PINK  = '#E07878';
const GREEN = '#5EC47A';
const BG_LIGHT = require('../../../assets/images/sona-light-bg.png');
const BG_DARK  = require('../../../assets/images/sona-bg-dark.png');

const TREATMENTS = [
  'Botox / Dysport', 'Dermal Fillers', 'Sculptra', 'Kybella',
  'Laser Resurfacing', 'IPL / Photofacial', 'Microneedling',
  'Chemical Peel', 'Hydrafacial', 'CoolSculpting', 'Semaglutide',
];

type SymptomKey = 'bruising' | 'swelling' | 'pain' | 'nausea' | 'redness';

const SYMPTOMS: { key: SymptomKey; label: string; emoji: string }[] = [
  { key: 'bruising',  label: 'Bruising',  emoji: '🟣' },
  { key: 'swelling',  label: 'Swelling',  emoji: '💧' },
  { key: 'pain',      label: 'Pain / Discomfort', emoji: '⚡' },
  { key: 'nausea',    label: 'Nausea',    emoji: '🌀' },
  { key: 'redness',   label: 'Redness',   emoji: '🔴' },
];

// ── Animated slider ─────────────────────────────────────────────────────────
function SymptomSlider({ label, emoji, value, onChange, TX, MT, CARD, BORD }: {
  label: string; emoji: string; value: number;
  onChange: (v: number) => void;
  TX: string; MT: string; CARD: string; BORD: string;
}) {
  const steps = [0,1,2,3,4,5,6,7,8,9,10];
  const color = value <= 3 ? GREEN : value <= 6 ? GOLD : PINK;
  return (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: TX }}>
          {emoji}  {label}
        </Text>
        <View style={{ backgroundColor: color + '22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: color + '55' }}>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color, fontWeight: '700' }}>{value}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {steps.map((s) => (
          <Pressable key={s} onPress={() => onChange(s)}
            style={{ flex: 1, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center',
              backgroundColor: s <= value ? color + '30' : CARD,
              borderWidth: 1, borderColor: s <= value ? color + '60' : BORD }}>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: s === value ? 13 : 10,
              color: s <= value ? color : MT, fontWeight: s === value ? '700' : '400' }}>
              {s}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 9, color: MT }}>None</Text>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 9, color: MT }}>Severe</Text>
      </View>
    </View>
  );
}

export default function PostTreatmentCheckin() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tokens, resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';
  const { treatment, window: timeWindow } = useLocalSearchParams<{ treatment?: string; window?: string }>();

  const CARD = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.84)';
  const BORD = isDark ? 'rgba(191,141,54,0.22)'  : 'rgba(191,141,54,0.18)';
  const TX   = tokens.colors.text;
  const MT   = tokens.colors.textMuted;
  const SH   = { shadowColor: '#3d2b1a', shadowOffset: { width: 0, height: 4 } as const, shadowOpacity: 0.12, shadowRadius: 10, elevation: 6 };

  const [selectedTreatment, setSelectedTreatment] = useState(treatment ?? '');
  const [symptoms, setSymptoms] = useState<Record<SymptomKey, number>>({
    bruising: 0, swelling: 0, pain: 0, nausea: 0, redness: 0,
  });
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const overallSeverity = Math.max(...Object.values(symptoms));
  const severityLabel = overallSeverity === 0 ? 'No symptoms' : overallSeverity <= 3 ? 'Mild' : overallSeverity <= 6 ? 'Moderate' : 'Significant';
  const severityColor = overallSeverity === 0 ? GREEN : overallSeverity <= 3 ? GREEN : overallSeverity <= 6 ? GOLD : PINK;

  const handleSubmit = () => {
    if (!selectedTreatment) {
      Alert.alert('Select treatment', 'Please select which treatment you received.');
      return;
    }
    // TODO: save to Supabase
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <ImageBackground source={isDark ? BG_DARK : BG_LIGHT} style={{ flex: 1 }} resizeMode="cover">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 52, marginBottom: 16 }}>✓</Text>
          <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 28, color: TX, textAlign: 'center', marginBottom: 8 }}>
            Check-in submitted
          </Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: MT, textAlign: 'center', marginBottom: 32 }}>
            Your care team has been notified. Rest well and stay hydrated.
          </Text>
          {overallSeverity >= 7 && (
            <View style={{ backgroundColor: PINK + '18', borderRadius: 14, borderWidth: 1, borderColor: PINK + '40', padding: 16, marginBottom: 20, width: '100%' }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: PINK, marginBottom: 4 }}>Higher symptom severity noted</Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT }}>We recommend contacting Simi directly for guidance.</Text>
            </View>
          )}
          <Pressable style={{ backgroundColor: GOLD, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, marginBottom: 12 }}
            onPress={() => router.back()}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#fff' }}>Done</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL('sms:+1')}>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: GOLD }}>📞 Text Simi directly</Text>
          </Pressable>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={isDark ? BG_DARK : BG_LIGHT} style={{ flex: 1 }} resizeMode="cover">
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* Header */}
        <Pressable onPress={() => router.back()} style={{ marginBottom: 4 }}>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: GOLD }}>← Back</Text>
        </Pressable>
        <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 32, color: TX, marginBottom: 2 }}>
          Recovery Check-In
        </Text>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT, marginBottom: 16 }}>
          {timeWindow ? `${timeWindow}-hour post-treatment check` : 'How are you feeling after your treatment?'}
        </Text>

        {/* Treatment selector */}
        <View style={{ backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORD, padding: 16, marginBottom: 12, ...SH }}>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 12 }}>TREATMENT RECEIVED</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {TREATMENTS.map((t) => (
              <Pressable key={t} onPress={() => setSelectedTreatment(t)}
                style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1,
                  borderColor: selectedTreatment === t ? GOLD : BORD,
                  backgroundColor: selectedTreatment === t ? GOLD + '20' : 'transparent' }}>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12,
                  color: selectedTreatment === t ? GOLD : MT }}>{t}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Overall status banner */}
        {Object.values(symptoms).some(v => v > 0) && (
          <View style={{ backgroundColor: severityColor + '15', borderRadius: 14, borderWidth: 1, borderColor: severityColor + '40', padding: 14, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: TX }}>Overall severity</Text>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: severityColor, fontWeight: '700' }}>{severityLabel}</Text>
            </View>
          </View>
        )}

        {/* Symptom sliders */}
        <View style={{ backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORD, padding: 16, marginBottom: 12, ...SH }}>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 16 }}>SYMPTOMS  (0 = none, 10 = severe)</Text>
          {SYMPTOMS.map((s) => (
            <SymptomSlider key={s.key} label={s.label} emoji={s.emoji}
              value={symptoms[s.key]}
              onChange={(v) => setSymptoms(prev => ({ ...prev, [s.key]: v }))}
              TX={TX} MT={MT} CARD={CARD} BORD={BORD} />
          ))}
        </View>

        {/* Recovery notes */}
        <View style={{ backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORD, padding: 16, marginBottom: 12, ...SH }}>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 10 }}>RECOVERY NOTES</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="How are you feeling? Any concerns or questions for your provider..."
            placeholderTextColor={MT}
            multiline
            numberOfLines={4}
            style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: TX,
              minHeight: 100, textAlignVertical: 'top', lineHeight: 20 }}
          />
        </View>

        {/* Photo upload */}
        <View style={{ backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORD, padding: 16, marginBottom: 12, ...SH }}>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 12 }}>TREATMENT AREA PHOTO  (optional)</Text>
          <Pressable
            onPress={() => Alert.alert('Camera', 'Photo upload coming soon — tap to select from library.')}
            style={{ borderRadius: 14, borderWidth: 1.5, borderColor: BORD, borderStyle: 'dashed',
              height: 120, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Text style={{ fontSize: 28 }}>📷</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT }}>Tap to add a photo</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT + '88' }}>Helps your provider track healing</Text>
          </Pressable>
        </View>

        {/* Action buttons */}
        <Pressable
          style={{ backgroundColor: GOLD, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10, ...SH }}
          onPress={handleSubmit}>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#fff', fontWeight: '600' }}>Submit Check-In</Text>
        </Pressable>

        <Pressable
          style={{ backgroundColor: CARD, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: BORD }}
          onPress={() => Linking.openURL('sms:+1')}>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: TX }}>💬  Message Simi directly</Text>
        </Pressable>

        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 10, color: MT, textAlign: 'center', marginTop: 12 }}>
          For emergencies call 911 · This is not a substitute for medical advice
        </Text>

      </ScrollView>
    </ImageBackground>
  );
}
