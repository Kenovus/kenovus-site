/**
 * Post-Treatment Check-In — canonical screen at /patient/check-in
 * Accessible from Home screen banner, push notifications, and Appointments.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert, ImageBackground, KeyboardAvoidingView, Linking,
  Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/theme/ThemeProvider';

const GOLD  = '#BF8D36';
const GREEN = '#5EC47A';
const PINK  = '#E07878';
const AMBER = '#E8A830';
const BG_L  = require('../../assets/images/sona-light-bg.png');
const BG_D  = require('../../assets/images/sona-bg-dark.png');

const TREATMENTS = [
  'Botox / Dysport', 'Dermal Fillers', 'Sculptra', 'Kybella',
  'Laser Resurfacing', 'IPL / Photofacial', 'Microneedling',
  'Chemical Peel', 'Hydrafacial', 'CoolSculpting', 'Semaglutide Injection',
];

type SymptomKey = 'nausea' | 'bruising' | 'swelling' | 'pain';

const SYMPTOMS: { key: SymptomKey; label: string; emoji: string }[] = [
  { key: 'nausea',   label: 'Nausea',             emoji: '🌀' },
  { key: 'bruising', label: 'Bruising',            emoji: '🟣' },
  { key: 'swelling', label: 'Swelling',            emoji: '💧' },
  { key: 'pain',     label: 'Pain / Discomfort',   emoji: '⚡' },
];

function SliderRow({ label, emoji, value, onChange, TX, MT, BORD, CARD }: {
  label: string; emoji: string; value: number; onChange: (v: number) => void;
  TX: string; MT: string; BORD: string; CARD: string;
}) {
  const col = value === 0 ? MT : value <= 3 ? GREEN : value <= 6 ? AMBER : PINK;
  return (
    <View style={{ marginBottom: 18 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: TX }}>{emoji}  {label}</Text>
        <View style={{ backgroundColor: col + '20', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: col + '50' }}>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: col, fontWeight: '700' }}>{value}</Text>
        </View>
      </View>
      {/* Step dots 0–10 */}
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {Array.from({ length: 11 }, (_, i) => (
          <Pressable key={i} onPress={() => onChange(i)} style={{ flex: 1 }}>
            <View style={{
              height: 32, borderRadius: 7, borderWidth: 1,
              backgroundColor: i <= value && value > 0 ? col + '28' : CARD,
              borderColor: i === value ? col : i < value && value > 0 ? col + '55' : BORD,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{
                fontFamily: 'DMSans_400Regular',
                fontSize: i === value ? 12 : 9,
                color: i <= value && value > 0 ? col : MT,
                fontWeight: i === value ? '700' : '400',
              }}>{i}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 9, color: MT }}>None</Text>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 9, color: MT }}>Severe</Text>
      </View>
    </View>
  );
}

export default function CheckInScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tokens, resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';
  const { treatment: prefilledTreatment } = useLocalSearchParams<{ treatment?: string }>();

  const CARD = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.84)';
  const BORD = isDark ? 'rgba(191,141,54,0.22)'  : 'rgba(191,141,54,0.18)';
  const TX   = tokens.colors.text;
  const MT   = tokens.colors.textMuted;
  const SH   = { shadowColor:'#3d2b1a', shadowOffset:{width:0,height:4} as const, shadowOpacity:0.12, shadowRadius:10, elevation:6 };

  const [selectedTx, setSelectedTx]   = useState(prefilledTreatment ?? '');
  const [symptoms, setSymptoms]        = useState<Record<SymptomKey,number>>({ nausea:0, bruising:0, swelling:0, pain:0 });
  const [notes, setNotes]              = useState('');
  const [submitted, setSubmitted]      = useState(false);

  const setSymptom = (k: SymptomKey, v: number) => setSymptoms(p => ({ ...p, [k]: v }));
  const maxSeverity = Math.max(...Object.values(symptoms));
  const severityLabel = maxSeverity === 0 ? 'No symptoms' : maxSeverity <= 3 ? 'Mild' : maxSeverity <= 6 ? 'Moderate' : 'Significant';
  const severityColor = maxSeverity === 0 ? MT : maxSeverity <= 3 ? GREEN : maxSeverity <= 6 ? AMBER : PINK;

  const submit = () => {
    if (!selectedTx) { Alert.alert('Select treatment', 'Which treatment did you receive?'); return; }
    // TODO: persist to Supabase
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <ImageBackground source={isDark ? BG_D : BG_L} style={{ flex: 1 }} resizeMode="cover">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: GREEN + '20', borderWidth: 2, borderColor: GREEN, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 36 }}>✓</Text>
          </View>
          <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 28, color: TX, textAlign: 'center', marginBottom: 8 }}>Check-in submitted</Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: MT, textAlign: 'center', lineHeight: 20, marginBottom: 28 }}>
            Your care team has been notified.{'\n'}Rest well and stay hydrated.
          </Text>
          {maxSeverity >= 7 && (
            <View style={{ backgroundColor: PINK + '15', borderRadius: 14, borderWidth: 1, borderColor: PINK + '40', padding: 16, marginBottom: 20, width: '100%' }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: PINK, marginBottom: 4 }}>Higher severity noted</Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT }}>We recommend contacting Simi directly.</Text>
            </View>
          )}
          <Pressable onPress={() => router.back()}
            style={{ backgroundColor: GOLD, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40, marginBottom: 14, ...SH }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#fff' }}>Done</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL('sms:+1')}>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: GOLD }}>💬  Text Simi directly</Text>
          </Pressable>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={isDark ? BG_D : BG_L} style={{ flex: 1 }} resizeMode="cover">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32, paddingHorizontal: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          <Pressable onPress={() => router.back()} style={{ marginBottom: 4 }}>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: GOLD }}>← Back</Text>
          </Pressable>
          <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 32, color: TX, marginBottom: 2 }}>Recovery Check-In</Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT, marginBottom: 18 }}>
            How are you feeling after your treatment?
          </Text>

          {/* Treatment selector */}
          <View style={{ backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORD, padding: 16, marginBottom: 12, ...SH }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 12 }}>TREATMENT RECEIVED</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {TREATMENTS.map(t => (
                <Pressable key={t} onPress={() => setSelectedTx(t)} style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
                  borderColor: selectedTx === t ? GOLD : BORD,
                  backgroundColor: selectedTx === t ? GOLD + '1A' : 'transparent',
                }}>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: selectedTx === t ? GOLD : MT }}>{t}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Severity summary */}
          {maxSeverity > 0 && (
            <View style={{ backgroundColor: severityColor + '12', borderRadius: 14, borderWidth: 1, borderColor: severityColor + '40', padding: 13, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: TX }}>Overall severity</Text>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: severityColor, fontWeight: '700' }}>{severityLabel}</Text>
            </View>
          )}

          {/* Symptom sliders */}
          <View style={{ backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORD, padding: 16, marginBottom: 12, ...SH }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 16 }}>SYMPTOMS  (0 = none · 10 = severe)</Text>
            {SYMPTOMS.map(s => (
              <SliderRow key={s.key} label={s.label} emoji={s.emoji}
                value={symptoms[s.key]} onChange={v => setSymptom(s.key, v)}
                TX={TX} MT={MT} BORD={BORD} CARD={CARD} />
            ))}
          </View>

          {/* Recovery notes */}
          <View style={{ backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORD, padding: 16, marginBottom: 12, ...SH }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 10 }}>RECOVERY NOTES</Text>
            <TextInput
              value={notes} onChangeText={setNotes} multiline numberOfLines={4}
              placeholder="How are you feeling? Any questions for your provider..."
              placeholderTextColor={tokens.colors.textCaption}
              style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: TX, minHeight: 90, textAlignVertical: 'top', lineHeight: 21 }}
            />
          </View>

          {/* Photo upload */}
          <Pressable
            onPress={() => Alert.alert('Photo', 'Select from library or take a new photo.', [
              { text: 'Take Photo', onPress: () => {} },
              { text: 'Choose from Library', onPress: () => {} },
              { text: 'Cancel', style: 'cancel' },
            ])}
            style={{ backgroundColor: CARD, borderRadius: 18, borderWidth: 1.5, borderColor: BORD, borderStyle: 'dashed', height: 90, alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16, ...SH }}>
            <Text style={{ fontSize: 24 }}>📷</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT }}>Add a recovery photo (optional)</Text>
          </Pressable>

          {/* Actions */}
          <Pressable onPress={submit}
            style={{ backgroundColor: GOLD, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10, ...SH }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#fff', fontWeight: '600' }}>Submit Check-In</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL('sms:+1')}
            style={{ backgroundColor: CARD, borderRadius: 14, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: BORD }}>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: TX }}>💬  Message Simi directly</Text>
          </Pressable>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 10, color: MT, textAlign: 'center', marginTop: 12 }}>
            For emergencies call 911 · Not a substitute for medical advice
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}
