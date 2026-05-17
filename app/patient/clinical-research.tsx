/**
 * Clinical Research — AI-powered evidence search with cited sources.
 * Feels like OpenEvidence: submit a clinical question, get structured answer + sources.
 */
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useAppTheme } from '@/lib/theme/ThemeProvider';
import { anthropicMessages } from '@/lib/anthropic';

const GOLD = '#BF8D36';
const BG_DARK  = require('../../assets/images/sona-bg-dark.png');
const BG_LIGHT = require('../../assets/images/sona-light-bg.png');

const SYSTEM_PROMPT = `You are a clinical research assistant for Sona Medical Aesthetics (Newcastle, WA), led by Simi Kennedy CRNA ARNP. You specialize in aesthetic medicine, GLP-1 weight management, skin health, and wellness optimization.

Answer clinical questions with evidence-based responses. Prioritize research from the last 5 years. Always cite 2-3 specific sources.

Format your response EXACTLY like this JSON:
{
  "answer": "Your clear, concise clinical answer here. Be direct and clinically precise. 2-4 paragraphs max.",
  "sources": [
    { "journal": "Journal Name", "year": 2024, "finding": "One sentence describing the key finding relevant to the question.", "relevance": "high" },
    { "journal": "Journal Name", "year": 2023, "finding": "Key finding.", "relevance": "medium" }
  ],
  "clinical_note": "One-sentence practical takeaway for the clinical setting."
}

Only output the JSON object, no other text.`;

const EXAMPLE_QUERIES = [
  'What does research say about semaglutide for aesthetic fat reduction?',
  'Evidence for RF microneedling vs traditional microneedling for collagen?',
  'GLP-1 and muscle mass preservation — what does current research show?',
  'Optimal protein intake during GLP-1 therapy for body composition?',
];

interface Source {
  journal: string;
  year: number;
  finding: string;
  relevance: 'high' | 'medium' | 'low';
}

interface ParsedResult {
  answer: string;
  sources: Source[];
  clinical_note: string;
}

function BackIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  );
}

function relevanceColor(r: string) {
  if (r === 'high') return '#5EC47A';
  if (r === 'medium') return GOLD;
  return '#9a826a';
}

export default function ClinicalResearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tokens, resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';
  const TX   = tokens.colors.text;
  const MT   = tokens.colors.textMuted;
  const CARD = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.88)';
  const BORD = isDark ? 'rgba(191,141,54,0.22)'  : 'rgba(191,141,54,0.18)';
  const SH   = { shadowColor: '#3d2b1a', shadowOffset: { width: 0, height: 4 } as const, shadowOpacity: 0.12, shadowRadius: 10, elevation: 5 };

  const [query, setQuery]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<ParsedResult | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const search = async (q?: string) => {
    const searchQuery = (q ?? query).trim();
    if (!searchQuery) return;
    setLoading(true);
    setResult(null);
    setRawError(null);

    const { text, error } = await anthropicMessages({
      system: SYSTEM_PROMPT,
      user: searchQuery,
      maxTokens: 1200,
    });

    setLoading(false);

    if (error || !text) {
      setRawError(error?.message ?? 'No response received.');
      return;
    }

    try {
      const parsed = JSON.parse(text) as ParsedResult;
      setResult(parsed);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } catch {
      // Claude didn't return valid JSON — show raw text
      setResult({ answer: text, sources: [], clinical_note: '' });
    }
  };

  return (
    <ImageBackground source={isDark ? BG_DARK : BG_LIGHT} style={{ flex: 1 }} resizeMode="cover">
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: isDark ? 'rgba(5,3,2,0.72)' : 'rgba(245,240,232,0.80)' }]} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>

        {/* Header */}
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: BORD }}>
            <BackIcon color={TX} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 22, color: TX }}>Clinical Research</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT }}>AI-powered · Cited sources · 5-year bias</Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Search bar */}
          <View style={[{ backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORD, flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 14 }, SH]}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Ask a clinical question…"
              placeholderTextColor={MT}
              style={{ flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 15, color: TX }}
              returnKeyType="search"
              onSubmitEditing={() => void search()}
              multiline={false}
            />
            <Pressable
              onPress={() => void search()}
              disabled={loading || !query.trim()}
              style={{ backgroundColor: GOLD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, opacity: (loading || !query.trim()) ? 0.5 : 1 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#fff' }}>
                {loading ? '…' : 'Search'}
              </Text>
            </Pressable>
          </View>

          {/* Example queries */}
          {!result && !loading && (
            <>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 8 }}>EXAMPLE QUESTIONS</Text>
              {EXAMPLE_QUERIES.map((q) => (
                <Pressable
                  key={q}
                  onPress={() => { setQuery(q); void search(q); }}
                  style={[{ backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORD, padding: 14, marginBottom: 8 }, SH]}>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: TX, lineHeight: 20 }}>{q}</Text>
                </Pressable>
              ))}
            </>
          )}

          {/* Loading */}
          {loading && (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <ActivityIndicator color={GOLD} size="large" />
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: MT, marginTop: 14 }}>Searching clinical literature…</Text>
            </View>
          )}

          {/* Error */}
          {rawError && (
            <View style={[{ backgroundColor: 'rgba(224,120,120,0.15)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(224,120,120,0.4)', padding: 14, marginBottom: 14 }, SH]}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#E07878', marginBottom: 4 }}>Connection error</Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT }}>{rawError}</Text>
            </View>
          )}

          {/* Result */}
          {result && (
            <>
              {/* Answer card */}
              <View style={[{ backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORD, padding: 18, marginBottom: 12 }, SH]}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: GOLD, letterSpacing: 1.4, marginBottom: 10 }}>✦ CLINICAL ANSWER</Text>
                <Text style={{ fontFamily: 'PTSerif_400Regular', fontSize: 16, color: TX, lineHeight: 26 }}>{result.answer}</Text>
                {result.clinical_note ? (
                  <View style={{ backgroundColor: GOLD + '18', borderRadius: 10, padding: 12, marginTop: 14, borderWidth: 1, borderColor: GOLD + '40' }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: GOLD, marginBottom: 4 }}>CLINICAL NOTE</Text>
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: TX, lineHeight: 20 }}>{result.clinical_note}</Text>
                  </View>
                ) : null}
              </View>

              {/* Sources */}
              {result.sources.length > 0 && (
                <>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 8 }}>CITED SOURCES</Text>
                  {result.sources.map((src, i) => (
                    <View key={i} style={[{ backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORD, padding: 14, marginBottom: 8, flexDirection: 'row', gap: 12 }, SH]}>
                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: relevanceColor(src.relevance) + '20', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: relevanceColor(src.relevance) + '50', flexShrink: 0 }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: relevanceColor(src.relevance) }}>{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: TX, flex: 1 }} numberOfLines={1}>{src.journal}</Text>
                          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT }}>{src.year}</Text>
                          <View style={{ backgroundColor: relevanceColor(src.relevance) + '20', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 9, color: relevanceColor(src.relevance) }}>{src.relevance.toUpperCase()}</Text>
                          </View>
                        </View>
                        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT, lineHeight: 19 }}>{src.finding}</Text>
                      </View>
                    </View>
                  ))}
                </>
              )}

              {/* Ask follow-up */}
              <Pressable
                onPress={() => { setResult(null); setQuery(''); }}
                style={[{ backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORD, paddingVertical: 14, alignItems: 'center', marginTop: 4 }, SH]}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: GOLD }}>+ New search</Text>
              </Pressable>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}
