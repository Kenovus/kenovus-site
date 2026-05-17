/**
 * Skin Insight Screen
 * Upload selfie → AI analysis → top 3 skin concerns + Sona treatment recommendations.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/lib/theme/ThemeProvider';

const GOLD  = '#BF8D36';
const PINK  = '#E07878';
const BLUE  = '#5BC4DC';
const GREEN = '#5EC47A';
const AMBER = '#E8A830';
const BG_LIGHT = require('../../../assets/images/sona-light-bg.png');
const BG_DARK  = require('../../../assets/images/sona-bg-dark.png');

type Severity = 'Mild' | 'Moderate' | 'Significant';

interface Concern {
  name: string;
  severity: Severity;
  description: string;
  icon: string;
  treatments: string[];
  color: string;
}

const MOCK_CONCERNS: Concern[] = [
  {
    name: 'Fine Lines & Wrinkles',
    severity: 'Moderate',
    description: 'Dynamic lines visible around the forehead and periocular region at rest.',
    icon: '〜',
    color: PINK,
    treatments: ['Botox / Dysport', 'Sculptra', 'Microneedling with PRP', 'Laser Resurfacing'],
  },
  {
    name: 'Hyperpigmentation',
    severity: 'Mild',
    description: 'Uneven skin tone with solar lentigines on cheeks and upper lip area.',
    icon: '☀',
    color: AMBER,
    treatments: ['IPL / Photofacial', 'Chemical Peel', 'Hydrafacial Brightening', 'Topical Vitamin C Protocol'],
  },
  {
    name: 'Loss of Volume',
    severity: 'Mild',
    description: 'Subtle hollowing under the eyes and midface deflation consistent with age-related volume loss.',
    icon: '◎',
    color: BLUE,
    treatments: ['Dermal Fillers (HA)', 'Sculptra Aesthetic', 'Radiesse', 'PRP Bio-stimulation'],
  },
];

const SEVERITY_COLOR: Record<Severity, string> = {
  Mild: GREEN, Moderate: AMBER, Significant: PINK,
};
const SEVERITY_BG: Record<Severity, string> = {
  Mild: GREEN + '18', Moderate: AMBER + '18', Significant: PINK + '18',
};

export default function SkinInsightScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tokens, resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';

  const CARD = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.84)';
  const BORD = isDark ? 'rgba(191,141,54,0.22)'  : 'rgba(191,141,54,0.18)';
  const TX   = tokens.colors.text;
  const MT   = tokens.colors.textMuted;
  const CP   = tokens.colors.textCaption;
  const SH   = { shadowColor: '#3d2b1a', shadowOffset: { width: 0, height: 4 } as const, shadowOpacity: 0.12, shadowRadius: 10, elevation: 6 };

  const [analysed, setAnalysed] = useState(false);
  const [analysing, setAnalysing] = useState(false);

  const handleUpload = () => {
    Alert.alert('Upload Selfie', 'Choose how to add your photo', [
      { text: 'Take Photo', onPress: () => simulateAnalysis() },
      { text: 'Choose from Library', onPress: () => simulateAnalysis() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const simulateAnalysis = () => {
    setAnalysing(true);
    setTimeout(() => { setAnalysing(false); setAnalysed(true); }, 1800);
  };

  return (
    <ImageBackground source={isDark ? BG_DARK : BG_LIGHT} style={{ flex: 1 }} resizeMode="cover">
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}>

        <Pressable onPress={() => router.back()} style={{ marginBottom: 4 }}>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: GOLD }}>← Back</Text>
        </Pressable>
        <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 32, color: TX, marginBottom: 2 }}>Skin Insight</Text>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT, marginBottom: 20 }}>
          AI-powered skin analysis with personalized Sona treatment recommendations
        </Text>

        {/* Upload / Before-After section */}
        <View style={{ backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORD, padding: 16, marginBottom: 12, ...SH }}>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 12 }}>PHOTO ANALYSIS</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {/* Before */}
            <Pressable onPress={handleUpload}
              style={{ flex: 1, height: 140, borderRadius: 14, borderWidth: 1.5, borderColor: BORD, borderStyle: 'dashed',
                alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }}>
              {analysed ? (
                <Text style={{ fontSize: 40 }}>🤳</Text>
              ) : (
                <>
                  <Text style={{ fontSize: 32 }}>📷</Text>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: GOLD }}>Upload Selfie</Text>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 10, color: MT }}>Front-facing, good light</Text>
                </>
              )}
              {analysed && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: GREEN }}>✓ Analysed</Text>}
            </Pressable>
            {/* After placeholder */}
            <View style={{ flex: 1, height: 140, borderRadius: 14, borderWidth: 1.5, borderColor: BORD, borderStyle: 'dashed',
              alignItems: 'center', justifyContent: 'center', gap: 6, opacity: 0.5 }}>
              <Text style={{ fontSize: 32 }}>🌟</Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT, textAlign: 'center' }}>After treatment{'\n'}photo</Text>
            </View>
          </View>
          {!analysed && (
            <Pressable style={{ backgroundColor: GOLD, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12 }}
              onPress={handleUpload} disabled={analysing}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#fff' }}>
                {analysing ? 'Analysing…' : '✦  Analyse My Skin'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Analysis results */}
        {analysed && (
          <>
            <View style={{ backgroundColor: GREEN + '15', borderRadius: 14, borderWidth: 1, borderColor: GREEN + '40', padding: 14, marginBottom: 12 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: TX }}>✓ Analysis complete — 3 concerns identified</Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: MT, marginTop: 2 }}>
                Based on your photo, here are your top skin priorities and the Sona treatments we recommend.
              </Text>
            </View>

            {MOCK_CONCERNS.map((c, i) => (
              <View key={c.name} style={{ backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORD, overflow: 'hidden', marginBottom: 12, ...SH }}>
                {/* Concern header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORD }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.color + '20', borderWidth: 1, borderColor: c.color + '40', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 18, color: c.color }}>{c.icon}</Text>
                    </View>
                    <View>
                      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: TX }}>#{i + 1}  {c.name}</Text>
                      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT, marginTop: 1 }}>{c.description}</Text>
                    </View>
                  </View>
                </View>

                {/* Severity badge */}
                <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <View style={{ backgroundColor: SEVERITY_BG[c.severity], borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: SEVERITY_COLOR[c.severity] + '50' }}>
                      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: SEVERITY_COLOR[c.severity] }}>{c.severity}</Text>
                    </View>
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: MT }}>severity</Text>
                  </View>
                </View>

                {/* Recommended treatments */}
                <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.2, marginBottom: 8 }}>SONA TREATMENTS</Text>
                  {c.treatments.map((t) => (
                    <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.color }} />
                      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: TX, flex: 1 }}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}

            {/* Book CTA */}
            <Pressable
              style={{ backgroundColor: GOLD, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10, ...SH }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#fff', fontWeight: '600' }}>
                Book a Sona Consultation →
              </Text>
            </Pressable>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 10, color: MT, textAlign: 'center' }}>
              AI analysis is for informational purposes only · Results may vary
            </Text>
          </>
        )}

      </ScrollView>
    </ImageBackground>
  );
}
