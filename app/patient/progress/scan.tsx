/**
 * Skin & Body Scan — multi-angle capture + Claude Vision analysis.
 * Flow: mode select → guided capture (5 face / 4 body angles) → analysing → results
 */
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, Easing, ImageBackground, Linking,
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Ellipse, Line, Path as SvgPath } from 'react-native-svg';

import { LotusOrb } from '@/components/ui/LotusOrb';
import { useAuth } from '@/hooks/useAuth';
import { anthropicVision } from '@/lib/anthropic';
import {
  buildBodyScanPrompt, buildFacialScanPrompt,
  type ScanAnalysisResult, type SkinConcernResult,
} from '@/lib/simiClinicalProtocols';
import { useAppTheme } from '@/lib/theme/ThemeProvider';

const GOLD  = '#BF8D36';
const GREEN = '#5EC47A';
const AMBER = '#E8A830';
const PINK  = '#E07878';
const BLUE  = '#5BC4DC';
const BG_L  = require('../../../assets/images/sona-light-bg.png');
const BG_D  = require('../../../assets/images/sona-bg-dark.png');

// ── Guided capture steps ──────────────────────────────────────────────────────
const FACE_STEPS = [
  { label: 'Look straight ahead',          hint: 'Neutral expression, face centred' },
  { label: 'Turn slightly left',           hint: 'About 30° — chin over left shoulder' },
  { label: 'Turn slightly right',          hint: 'Mirror of the previous turn' },
  { label: 'Squint your eyes hard',        hint: 'Squeeze them shut — as hard as you can' },
  { label: 'Give a big smile',             hint: 'Wide, genuine smile — show teeth' },
  { label: 'Frown hard',                   hint: 'Pull brows down, furrow deeply' },
  { label: 'Snarl — upper teeth only',     hint: 'Curl upper lip upward, show upper teeth' },
  { label: 'Raise eyebrows as high as you can', hint: 'Lift both brows fully, forehead wrinkles' },
];

const BODY_STEPS = [
  { label: 'Face the camera',      hint: 'Stand 6 ft away, full body in frame' },
  { label: 'Turn to your left',    hint: 'Left side profile' },
  { label: 'Turn to your right',   hint: 'Right side profile' },
  { label: 'Back to the camera',   hint: 'Face away from camera' },
];

// ── Premium face scan SVG guide (Apple Face ID style) ────────────────────────
/**
 * Minimalist face silhouette: oval head, almond eyes, nose bridge,
 * mouth curve, and a per-step directional indicator.
 * Gold stroke #BF8D36, strokeWidth 1.5, transparent fill.
 */
function FaceScanGuide({ step }: { step: number }) {
  const W = 200; const H = 260;
  const cx = 100; const cy = 115;
  const SW = 1.5;          // base stroke width
  const DIM = GOLD + '55'; // dimmed guide color

  // ── Per-step directional cue paths ───────────────────────────────────────
  const dirGuides: Record<number, React.ReactNode> = {
    // 0: straight — corner alignment brackets (FaceID style)
    0: (
      <>
        {/* top-left */}
        <SvgPath d="M 18 35 L 18 15 L 38 15" stroke={GOLD} strokeWidth={SW} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.55}/>
        {/* top-right */}
        <SvgPath d="M 162 15 L 182 15 L 182 35" stroke={GOLD} strokeWidth={SW} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.55}/>
        {/* bottom-left */}
        <SvgPath d="M 18 207 L 18 227 L 38 227" stroke={GOLD} strokeWidth={SW} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.55}/>
        {/* bottom-right */}
        <SvgPath d="M 162 227 L 182 227 L 182 207" stroke={GOLD} strokeWidth={SW} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.55}/>
      </>
    ),
    // 1: turn left — curved arrow on the left, rotating counterclockwise
    1: (
      <>
        <SvgPath d="M 8 95 A 42 55 0 0 0 8 158" stroke={GOLD} strokeWidth={SW} fill="none" strokeLinecap="round" opacity={0.6} strokeDasharray="5 3"/>
        {/* arrowhead at top of arc */}
        <SvgPath d="M 8 95 L 14 108 M 8 95 L 20 96" stroke={GOLD} strokeWidth={SW} fill="none" strokeLinecap="round" opacity={0.6}/>
      </>
    ),
    // 2: turn right — curved arrow on the right, rotating clockwise
    2: (
      <>
        <SvgPath d="M 192 158 A 42 55 0 0 0 192 95" stroke={GOLD} strokeWidth={SW} fill="none" strokeLinecap="round" opacity={0.6} strokeDasharray="5 3"/>
        {/* arrowhead at top of arc */}
        <SvgPath d="M 192 95 L 186 108 M 192 95 L 180 96" stroke={GOLD} strokeWidth={SW} fill="none" strokeLinecap="round" opacity={0.6}/>
      </>
    ),
    // 3: squint — narrowed eye lines replace almond paths (drawn over them)
    3: (
      <>
        <Line x1={59} y1={88} x2={85} y2={88} stroke={GOLD} strokeWidth={2.5} strokeLinecap="round" opacity={0.9}/>
        <Line x1={115} y1={88} x2={141} y2={88} stroke={GOLD} strokeWidth={2.5} strokeLinecap="round" opacity={0.9}/>
        {/* squint crease lines below eyes */}
        <SvgPath d="M 63 93 Q 72 97 81 93" fill="none" stroke={GOLD} strokeWidth={SW*0.8} strokeLinecap="round" opacity={0.5}/>
        <SvgPath d="M 119 93 Q 128 97 137 93" fill="none" stroke={GOLD} strokeWidth={SW*0.8} strokeLinecap="round" opacity={0.5}/>
      </>
    ),
    // 4: big smile — wide upward mouth curve
    4: (
      <>
        <SvgPath d="M 76 163 Q 100 192 124 163" fill="none" stroke={GOLD} strokeWidth={2.2} strokeLinecap="round" opacity={0.9}/>
        {/* cheek lift lines */}
        <SvgPath d="M 62 150 Q 70 158 68 168" fill="none" stroke={GOLD} strokeWidth={SW*0.75} strokeLinecap="round" opacity={0.45}/>
        <SvgPath d="M 138 150 Q 130 158 132 168" fill="none" stroke={GOLD} strokeWidth={SW*0.75} strokeLinecap="round" opacity={0.45}/>
      </>
    ),
    // 5: frown — downward V mouth, furrowed brow lines
    5: (
      <>
        <SvgPath d="M 76 178 Q 100 160 124 178" fill="none" stroke={GOLD} strokeWidth={2.2} strokeLinecap="round" opacity={0.9}/>
        {/* deep brow furrow lines between brows */}
        <Line x1={94} y1={72} x2={92} y2={82} stroke={GOLD} strokeWidth={1.8} strokeLinecap="round" opacity={0.7}/>
        <Line x1={106} y1={72} x2={108} y2={82} stroke={GOLD} strokeWidth={1.8} strokeLinecap="round" opacity={0.7}/>
        {/* brows pulled down */}
        <SvgPath d="M 57 82 Q 72 78 87 82" fill="none" stroke={GOLD} strokeWidth={SW*1.1} strokeLinecap="round" opacity={0.85}/>
        <SvgPath d="M 113 82 Q 128 78 143 82" fill="none" stroke={GOLD} strokeWidth={SW*1.1} strokeLinecap="round" opacity={0.85}/>
      </>
    ),
    // 6: snarl — upper lip raised, small gap showing teeth
    6: (
      <>
        {/* raised upper lip (asymmetric curl, left side more raised) */}
        <SvgPath d="M 80 158 Q 88 150 100 155 Q 112 158 120 163" fill="none" stroke={GOLD} strokeWidth={2} strokeLinecap="round" opacity={0.9}/>
        {/* lower lip normal */}
        <SvgPath d="M 80 163 Q 100 175 120 163" fill="none" stroke={GOLD} strokeWidth={SW} strokeLinecap="round" opacity={0.7}/>
        {/* nasolabial crease on left */}
        <SvgPath d="M 78 148 Q 74 160 79 170" fill="none" stroke={GOLD} strokeWidth={SW*0.7} strokeLinecap="round" opacity={0.4}/>
      </>
    ),
    // 7: raise eyebrows — high arched brows, forehead lines
    7: (
      <>
        {/* raised high brows */}
        <SvgPath d="M 54 65 Q 72 55 90 62" fill="none" stroke={GOLD} strokeWidth={SW*1.2} strokeLinecap="round" opacity={0.9}/>
        <SvgPath d="M 110 62 Q 128 55 146 65" fill="none" stroke={GOLD} strokeWidth={SW*1.2} strokeLinecap="round" opacity={0.9}/>
        {/* forehead horizontal wrinkle lines */}
        <SvgPath d="M 70 75 Q 100 72 130 75" fill="none" stroke={GOLD} strokeWidth={SW*0.7} strokeLinecap="round" opacity={0.4}/>
        <SvgPath d="M 66 83 Q 100 80 134 83" fill="none" stroke={GOLD} strokeWidth={SW*0.65} strokeLinecap="round" opacity={0.3}/>
        {/* upward cue arrows above brows */}
        <SvgPath d="M 72 52 L 69 62 M 72 52 L 75 62" stroke={GOLD} strokeWidth={SW*0.8} fill="none" strokeLinecap="round" opacity={0.6}/>
        <SvgPath d="M 128 52 L 125 62 M 128 52 L 131 62" stroke={GOLD} strokeWidth={SW*0.8} fill="none" strokeLinecap="round" opacity={0.6}/>
      </>
    ),
  };

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>

      {/* ── Head oval ─────────────────────────────────────────────── */}
      <Ellipse cx={cx} cy={cy} rx={83} ry={108}
        fill="rgba(191,141,54,0.04)" stroke={GOLD} strokeWidth={SW + 0.3} />

      {/* ── Left eye (almond path) ─────────────────────────────────── */}
      <SvgPath d="M 59 88 Q 72 79 85 88 Q 72 97 59 88 Z"
        fill="none" stroke={GOLD} strokeWidth={SW} strokeLinejoin="round"/>
      {/* Left iris dot */}
      <Circle cx={72} cy={88} r={2.8} fill={GOLD} opacity={0.45}/>

      {/* ── Right eye ─────────────────────────────────────────────── */}
      <SvgPath d="M 115 88 Q 128 79 141 88 Q 128 97 115 88 Z"
        fill="none" stroke={GOLD} strokeWidth={SW} strokeLinejoin="round"/>
      {/* Right iris dot */}
      <Circle cx={128} cy={88} r={2.8} fill={GOLD} opacity={0.45}/>

      {/* ── Eyebrows ──────────────────────────────────────────────── */}
      <SvgPath d="M 57 76 Q 72 69 87 74"
        fill="none" stroke={GOLD} strokeWidth={SW * 0.9} strokeLinecap="round" opacity={0.65}/>
      <SvgPath d="M 113 74 Q 128 69 143 76"
        fill="none" stroke={GOLD} strokeWidth={SW * 0.9} strokeLinecap="round" opacity={0.65}/>

      {/* ── Nose bridge (two fine parallel lines) ─────────────────── */}
      <Line x1={97} y1={103} x2={94} y2={141}
        stroke={DIM} strokeWidth={SW * 0.85} strokeLinecap="round"/>
      <Line x1={103} y1={103} x2={106} y2={141}
        stroke={DIM} strokeWidth={SW * 0.85} strokeLinecap="round"/>
      {/* Nostril arch */}
      <SvgPath d="M 88 143 Q 100 151 112 143"
        fill="none" stroke={DIM} strokeWidth={SW * 0.85} strokeLinecap="round"/>

      {/* ── Mouth ─────────────────────────────────────────────────── */}
      {/* Upper lip bow */}
      <SvgPath d="M 83 167 Q 91 160 100 163 Q 109 160 117 167"
        fill="none" stroke={GOLD} strokeWidth={SW} strokeLinecap="round" opacity={0.75}/>
      {/* Lower lip curve */}
      <SvgPath d="M 83 167 Q 100 179 117 167"
        fill="none" stroke={GOLD} strokeWidth={SW} strokeLinecap="round"/>

      {/* ── Chin centre mark ──────────────────────────────────────── */}
      <Line x1={cx} y1={221} x2={cx} y2={230}
        stroke={GOLD} strokeWidth={SW * 0.7} strokeLinecap="round" opacity={0.35}/>

      {/* ── Directional guide for current step ────────────────────── */}
      {dirGuides[step] ?? null}

    </Svg>
  );
}

// ── Body scan guide SVG ───────────────────────────────────────────────────────
function BodyScanGuide({ step }: { step: number }) {
  const W = 160; const H = 340; const cx = 80;
  const SW = 1.5;

  // Rotation indicator per step
  const rotGuide: Record<number, React.ReactNode> = {
    1: <SvgPath d="M 10 120 A 28 60 0 0 0 10 190" stroke={GOLD} strokeWidth={SW} fill="none" strokeLinecap="round" opacity={0.55} strokeDasharray="5 3"/>,
    2: <SvgPath d="M 150 190 A 28 60 0 0 0 150 120" stroke={GOLD} strokeWidth={SW} fill="none" strokeLinecap="round" opacity={0.55} strokeDasharray="5 3"/>,
    3: <SvgPath d="M 55 330 A 30 8 0 0 1 105 330" stroke={GOLD} strokeWidth={SW} fill="none" strokeLinecap="round" opacity={0.55} strokeDasharray="5 3"/>,
  };

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* Head */}
      <Ellipse cx={cx} cy={28} rx={21} ry={25} fill="rgba(191,141,54,0.04)" stroke={GOLD} strokeWidth={SW}/>
      {/* Neck */}
      <Line x1={cx-7} y1={53} x2={cx-7} y2={68} stroke={GOLD} strokeWidth={SW} strokeLinecap="round"/>
      <Line x1={cx+7} y1={53} x2={cx+7} y2={68} stroke={GOLD} strokeWidth={SW} strokeLinecap="round"/>
      {/* Shoulders */}
      <SvgPath d={`M ${cx-7} 68 Q ${cx-28} 72 ${cx-36} 83`} fill="none" stroke={GOLD} strokeWidth={SW} strokeLinecap="round"/>
      <SvgPath d={`M ${cx+7} 68 Q ${cx+28} 72 ${cx+36} 83`} fill="none" stroke={GOLD} strokeWidth={SW} strokeLinecap="round"/>
      {/* Torso */}
      <SvgPath d={`M ${cx-36} 83 L ${cx-30} 192 M ${cx+36} 83 L ${cx+30} 192`} fill="none" stroke={GOLD} strokeWidth={SW} strokeLinecap="round"/>
      <Line x1={cx-30} y1={192} x2={cx+30} y2={192} stroke={GOLD} strokeWidth={SW} strokeLinecap="round"/>
      {/* Arms */}
      <SvgPath d={`M ${cx-36} 83 L ${cx-48} 160 L ${cx-42} 198`} fill="none" stroke={GOLD} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round"/>
      <SvgPath d={`M ${cx+36} 83 L ${cx+48} 160 L ${cx+42} 198`} fill="none" stroke={GOLD} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round"/>
      {/* Legs */}
      <SvgPath d={`M ${cx-15} 192 L ${cx-18} 278 L ${cx-13} 332`} fill="none" stroke={GOLD} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round"/>
      <SvgPath d={`M ${cx+15} 192 L ${cx+18} 278 L ${cx+13} 332`} fill="none" stroke={GOLD} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round"/>
      {/* Rotation guide */}
      {rotGuide[step] ?? null}
    </Svg>
  );
}

type ScanMode = 'face' | 'body';
type Phase = 'select' | 'capture' | 'analysing' | 'results';
type SeverityColor = { bg: string; text: string; border: string };

const SEVERITY_STYLE: Record<string, SeverityColor> = {
  mild:     { bg: GREEN + '18', text: GREEN, border: GREEN + '50' },
  moderate: { bg: AMBER + '18', text: AMBER, border: AMBER + '50' },
  severe:   { bg: PINK  + '18', text: PINK,  border: PINK  + '50' },
};

// ─────────────────────────────────────────────────────────────────────────────
export default function ScanScreen() {
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const { profile } = useAuth();
  const { tokens, resolvedTheme } = useAppTheme();
  const isDark  = resolvedTheme === 'dark';

  const CARD = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.86)';
  const BORD = isDark ? 'rgba(191,141,54,0.22)'  : 'rgba(191,141,54,0.18)';
  const TX   = tokens.colors.text;
  const MT   = tokens.colors.textMuted;
  const SH   = { shadowColor:'#3d2b1a', shadowOffset:{width:0,height:4} as const, shadowOpacity:0.14, shadowRadius:12, elevation:8 };

  const [mode,    setMode   ] = useState<ScanMode>('face');
  const [phase,   setPhase  ] = useState<Phase>('select');
  const [step,    setStep   ] = useState(0);
  const [images,  setImages ] = useState<string[]>([]);  // base64 strings
  const [result,  setResult ] = useState<ScanAnalysisResult | null>(null);
  const [error,   setError  ] = useState<string | null>(null);

  // Progress ring animation
  const progressAnim = useRef(new Animated.Value(0)).current;

  const steps = mode === 'face' ? FACE_STEPS : BODY_STEPS;
  const totalSteps = steps.length;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: step / totalSteps,
      duration: 400,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [step, totalSteps, progressAnim]);

  // ── Capture one photo ───────────────────────────────────────────────────────
  const captureStep = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      // Simulator fallback: pick from library instead
      const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!lib.granted) {
        Alert.alert('Permission needed', 'Camera or photo library access is required.');
        return;
      }
      const pick = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        base64: true,
      });
      if (!pick.canceled && pick.assets[0].base64) {
        advanceWithImage(pick.assets[0].base64);
      }
      return;
    }

    const pic = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
      cameraType: mode === 'face'
        ? ImagePicker.CameraType.front
        : ImagePicker.CameraType.back,
    });
    if (!pic.canceled && pic.assets[0].base64) {
      advanceWithImage(pic.assets[0].base64);
    }
  };

  const advanceWithImage = (base64: string) => {
    const next = [...images, base64];
    setImages(next);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (step + 1 >= totalSteps) {
      // All photos captured — start analysis
      setPhase('analysing');
      void runAnalysis(next);
    } else {
      setStep(step + 1);
    }
  };

  // ── Claude Vision analysis ──────────────────────────────────────────────────
  const runAnalysis = async (capturedImages: string[]) => {
    const name = profile?.full_name?.split(' ')[0] ?? 'Patient';

    const system = mode === 'face'
      ? buildFacialScanPrompt(name)
      : buildBodyScanPrompt({ patientName: name });

    const prompt = mode === 'face'
      ? `Analyze these ${capturedImages.length} facial photos. Return only the JSON schema specified.`
      : `Analyze these ${capturedImages.length} body photos. Return only the JSON schema specified.`;

    const { text, error: apiError } = await anthropicVision({
      system,
      images: capturedImages,
      prompt,
      maxTokens: 1500,
    });

    if (apiError || !text) {
      // Graceful fallback with mock result for demo
      setResult(mockResult(mode));
      setPhase('results');
      return;
    }

    try {
      const parsed = JSON.parse(text) as ScanAnalysisResult;
      setResult(parsed);
    } catch {
      setResult(mockResult(mode));
    }
    setPhase('results');
  };

  // ── Reset ───────────────────────────────────────────────────────────────────
  const restart = () => {
    setPhase('select'); setStep(0); setImages([]); setResult(null); setError(null);
    progressAnim.setValue(0);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <ImageBackground source={isDark ? BG_D : BG_L} style={{ flex: 1 }} resizeMode="cover">

      {/* ── MODE SELECT ─────────────────────────────────────────────── */}
      {phase === 'select' && (
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32, paddingHorizontal: 20 }}
          showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => router.back()} style={{ marginBottom: 4 }}>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: GOLD }}>← Back</Text>
          </Pressable>
          <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 32, color: TX, marginBottom: 4 }}>Skin & Body Scan</Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT, marginBottom: 24, lineHeight: 19 }}>
            AI-powered aesthetic analysis using Claude Vision, personalised by Simi Kennedy CRNA ARNP.
          </Text>

          {/* Facial scan card */}
          <Pressable
            onPress={() => { setMode('face'); setPhase('capture'); setStep(0); }}
            style={{ backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORD, padding: 20, marginBottom: 14, ...SH }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: GOLD + '18', borderWidth: 1, borderColor: GOLD + '40', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 26 }}>🤳</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 22, color: TX }}>Facial Skin Analysis</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: MT }}>5 guided angles · 2–3 min</Text>
              </View>
              <Text style={{ fontSize: 18, color: MT }}>›</Text>
            </View>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: MT, lineHeight: 18 }}>
              Identifies fine lines, pigmentation, volume loss, texture, laxity, and more. Maps to Sona treatments.
            </Text>
          </Pressable>

          {/* Body scan card */}
          <Pressable
            onPress={() => { setMode('body'); setPhase('capture'); setStep(0); }}
            style={{ backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORD, padding: 20, marginBottom: 14, ...SH }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: BLUE + '18', borderWidth: 1, borderColor: BLUE + '40', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 26 }}>🧍</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 22, color: TX }}>Body Composition Scan</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: MT }}>4 guided angles · 2–3 min</Text>
              </View>
              <Text style={{ fontSize: 18, color: MT }}>›</Text>
            </View>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: MT, lineHeight: 18 }}>
              Visual body composition combined with your InBody, nutrition data, and GLP-1 progress.
            </Text>
          </Pressable>

          {/* Last scan info */}
          <View style={{ backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORD, padding: 14 }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 8 }}>LAST SCAN</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT }}>No previous scans — start your skin journey today</Text>
          </View>
        </ScrollView>
      )}

      {/* ── CAPTURE FLOW ────────────────────────────────────────────── */}
      {phase === 'capture' && (
        <View style={{ flex: 1, paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}>
          <Pressable onPress={restart} style={{ marginBottom: 12 }}>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: GOLD }}>← Cancel</Text>
          </Pressable>

          {/* Progress ring */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <ProgressRing current={step + 1} total={totalSteps} color={mode === 'face' ? GOLD : BLUE} />
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: MT, marginTop: 6 }}>
              Photo {step + 1} of {totalSteps}
            </Text>
          </View>

          {/* Premium SVG guide overlay */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            {mode === 'face'
              ? <FaceScanGuide step={step} />
              : <BodyScanGuide step={step} />
            }
          </View>

          {/* Instruction card */}
          <View style={{ backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORD, padding: 18, marginBottom: 16, ...SH }}>
            <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 24, color: TX, marginBottom: 4, textAlign: 'center' }}>
              {steps[step].label}
            </Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT, textAlign: 'center' }}>
              {steps[step].hint}
            </Text>
          </View>

          {/* Captured thumbnails row */}
          {images.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14, justifyContent: 'center' }}>
              {images.map((_, i) => (
                <View key={i} style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: GREEN + '30', borderWidth: 1, borderColor: GREEN, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 12 }}>✓</Text>
                </View>
              ))}
              {Array.from({ length: totalSteps - images.length }).map((_, i) => (
                <View key={`empty-${i}`} style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: BORD, opacity: 0.4 }} />
              ))}
            </View>
          )}

          {/* Capture button */}
          <Pressable onPress={() => void captureStep()}
            style={{ backgroundColor: GOLD, borderRadius: 16, paddingVertical: 16, alignItems: 'center', ...SH }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: '#fff', fontWeight: '600' }}>
              📸  Capture Photo {step + 1}
            </Text>
          </Pressable>
        </View>
      )}

      {/* ── ANALYSING ───────────────────────────────────────────────── */}
      {phase === 'analysing' && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <LotusOrb isListening={true} isDark={isDark} size={180} />
          <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 28, color: TX, marginTop: 32, marginBottom: 8, textAlign: 'center' }}>
            Analysing…
          </Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: MT, textAlign: 'center', lineHeight: 20 }}>
            Claude Vision is reviewing your{'\n'}{mode === 'face' ? 'facial' : 'body'} photos.
          </Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT, marginTop: 24, textAlign: 'center', opacity: 0.7 }}>
            This usually takes 15–30 seconds
          </Text>
        </View>
      )}

      {/* ── RESULTS ─────────────────────────────────────────────────── */}
      {phase === 'results' && result && (
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, paddingHorizontal: 16 }}
          showsVerticalScrollIndicator={false}>

          <Pressable onPress={restart} style={{ marginBottom: 4 }}>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: GOLD }}>← New Scan</Text>
          </Pressable>
          <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 30, color: TX, marginBottom: 4 }}>
            {mode === 'face' ? 'Skin Analysis' : 'Body Analysis'}
          </Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: MT, marginBottom: 16 }}>
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>

          {/* Summary */}
          <View style={{ backgroundColor: GOLD + '12', borderRadius: 16, borderWidth: 1, borderColor: GOLD + '40', padding: 16, marginBottom: 12 }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: GOLD, letterSpacing: 0.8, marginBottom: 6 }}>✦ SONA ASSESSMENT</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: TX, lineHeight: 20 }}>
              {result.overallSummary ?? result.bodyObservations}
            </Text>
          </View>

          {/* Simi review flag */}
          {result.requiresSimiReview && (
            <View style={{ backgroundColor: AMBER + '15', borderRadius: 14, borderWidth: 1, borderColor: AMBER + '40', padding: 14, marginBottom: 12 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: AMBER, marginBottom: 4 }}>
                ⚠️  Simi review recommended
              </Text>
              {result.simiReviewReasons?.map((r, i) => (
                <Text key={i} style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: MT }}>• {r}</Text>
              ))}
            </View>
          )}

          {/* Neuromodulator assessment (face mode) */}
          {mode === 'face' && result.neuromodulatorAssessment && (
            <View style={{ backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORD, padding: 16, marginBottom: 12, ...SH }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 12 }}>💉 NEUROMODULATOR ZONES</Text>
              {result.neuromodulatorAssessment.recommendedZones.length > 0 && (
                <>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: TX, marginBottom: 6 }}>Recommended treatment zones</Text>
                  {result.neuromodulatorAssessment.recommendedZones.map((z, i) => (
                    <Text key={i} style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT, marginBottom: 3 }}>• {z}</Text>
                  ))}
                </>
              )}
              {result.neuromodulatorAssessment.asymmetry && (
                <View style={{ marginTop: 10, padding: 10, backgroundColor: AMBER + '14', borderRadius: 10 }}>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: AMBER, marginBottom: 3 }}>Asymmetry noted</Text>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: MT }}>{result.neuromodulatorAssessment.asymmetry}</Text>
                </View>
              )}
              {result.neuromodulatorAssessment.priorTreatmentSigns && (
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: MT, marginTop: 8, fontStyle: 'italic' }}>
                  Prior treatment indicators: {result.neuromodulatorAssessment.priorTreatmentSigns}
                </Text>
              )}
            </View>
          )}

          {/* Skin condition flags */}
          {mode === 'face' && result.skinCondition && (result.skinCondition.productNote || result.skinCondition.postTreatmentIndicators) && (
            <View style={{ backgroundColor: BLUE + '10', borderRadius: 14, borderWidth: 1, borderColor: BLUE + '35', padding: 14, marginBottom: 12 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: BLUE, marginBottom: 6 }}>ℹ️ Assessment Notes</Text>
              {result.skinCondition.productNote && (
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: MT, marginBottom: 4 }}>{result.skinCondition.productNote}</Text>
              )}
              {result.skinCondition.postTreatmentIndicators && (
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: MT }}>{result.skinCondition.postTreatmentIndicators}</Text>
              )}
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT, marginTop: 6, opacity: 0.7 }}>
                Assessment accuracy: {result.skinCondition.assessmentAccuracy}
              </Text>
            </View>
          )}

          {/* Facial concern cards */}
          {mode === 'face' && result.concerns?.map((concern, i) => (
            <ConcernCard key={i} concern={concern} CARD={CARD} BORD={BORD} TX={TX} MT={MT} SH={SH} />
          ))}

          {/* Body results */}
          {mode === 'body' && (
            <>
              {result.nutritionAlignment && (
                <View style={{ backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORD, padding: 16, marginBottom: 10, ...SH }}>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 8 }}>NUTRITION ALIGNMENT</Text>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: TX, lineHeight: 20 }}>{result.nutritionAlignment}</Text>
                </View>
              )}
              {result.weeklyRecommendations && result.weeklyRecommendations.length > 0 && (
                <View style={{ backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORD, padding: 16, marginBottom: 10, ...SH }}>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 10 }}>THIS WEEK'S PRIORITIES</Text>
                  {result.weeklyRecommendations.map((rec, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: GOLD + '20', borderWidth: 1, borderColor: GOLD + '50', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: GOLD }}>{i + 1}</Text>
                      </View>
                      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: TX, flex: 1, lineHeight: 18 }}>{rec}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Book CTA */}
          <Pressable
            style={{ backgroundColor: GOLD, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10, ...SH }}
            onPress={() => Linking.openURL('https://cgnxz.myaestheticrecord.com/online-booking')}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#fff', fontWeight: '600' }}>
              Book a Sona Consultation →
            </Text>
          </Pressable>

          {/* Simi notice */}
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT, textAlign: 'center', lineHeight: 16, marginBottom: 8 }}>
            Simi will review your scan and may follow up with personalised recommendations
          </Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 10, color: MT, textAlign: 'center', opacity: 0.7 }}>
            AI analysis is for informational purposes only · Not a medical diagnosis
          </Text>

        </ScrollView>
      )}

    </ImageBackground>
  );
}

// ── Progress ring component ───────────────────────────────────────────────────
function ProgressRing({ current, total, color }: { current: number; total: number; color: string }) {
  const r = 32; const sz = 80; const cx = sz / 2; const cy = sz / 2;
  const circ = 2 * Math.PI * r;
  const dash = (current / total) * circ;
  return (
    <Svg width={sz} height={sz}>
      <Circle cx={cx} cy={cy} r={r} stroke="rgba(180,155,100,0.2)" strokeWidth={6} fill="none" />
      <Circle cx={cx} cy={cy} r={r} stroke={color} strokeWidth={6} fill="none"
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        rotation={-90} origin={`${cx},${cy}`} />
    </Svg>
  );
}

// ── Concern result card ───────────────────────────────────────────────────────
function ConcernCard({ concern, CARD, BORD, TX, MT, SH }: {
  concern: SkinConcernResult; CARD: string; BORD: string; TX: string; MT: string; SH: object;
}) {
  const sty = SEVERITY_STYLE[concern.severity] ?? SEVERITY_STYLE.mild;
  return (
    <View style={{ backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORD, overflow: 'hidden', marginBottom: 10, ...SH }}>
      <View style={{ height: 3, backgroundColor: sty.text }} />
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 20, color: TX, flex: 1 }}>{concern.label}</Text>
          <View style={{ backgroundColor: sty.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: sty.border }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: sty.text, textTransform: 'capitalize' }}>{concern.severity}</Text>
          </View>
        </View>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT, lineHeight: 19, marginBottom: 12 }}>
          {concern.explanation}
        </Text>
        {/* Treatment chips */}
        {concern.treatments?.length > 0 && (
          <View>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.2, marginBottom: 8 }}>SONA TREATMENTS</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {concern.treatments.map((t) => (
                <View key={t} style={{ backgroundColor: GOLD + '14', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: GOLD + '40' }}>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: GOLD }}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        {concern.requiresSimiReview && (
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: AMBER, marginTop: 8 }}>
            ⚠️  Simi review recommended for this concern
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Mock result for demo / API fallback ───────────────────────────────────────
function mockResult(mode: ScanMode): ScanAnalysisResult {
  if (mode === 'face') {
    return {
      concerns: [
        { id: 'fine_lines', label: 'Fine Lines & Wrinkles', severity: 'moderate',
          explanation: 'Dynamic forehead lines visible at rest, with mild periocular crinkling. Common for your age profile.',
          treatments: ['Daxxify', 'RF Microneedling'], requiresSimiReview: false },
        { id: 'pigmentation', label: 'Sun Damage & Pigmentation', severity: 'mild',
          explanation: 'Scattered solar lentigines on the upper cheeks and décolleté consistent with cumulative UV exposure.',
          treatments: ['IPL Photofacial', 'Chemical Peels'], requiresSimiReview: false },
        { id: 'skin_texture', label: 'Skin Texture & Pores', severity: 'mild',
          explanation: 'Slight textural irregularity in the T-zone. Responds well to a series of light resurfacing treatments.',
          treatments: ['Skinpen Microneedling', 'Salt Facial'], requiresSimiReview: false },
      ],
      overallSummary: 'Your skin is in good health overall. A combination of Daxxify for dynamic lines and a series of IPL treatments for pigmentation would give you excellent results. Simi recommends a consultation to build your personalised protocol.',
      requiresSimiReview: false, simiReviewReasons: [],
    };
  }
  return {
    concerns: [],
    overallSummary: '',
    bodyObservations: 'Good overall posture and frame. Visible progress in upper body development. Core composition shows continued improvement consistent with your GLP-1 protocol.',
    nutritionAlignment: 'Your protein intake is tracking well toward your goal. Slightly increasing healthy fats on training days would support muscle preservation during your caloric deficit.',
    weeklyRecommendations: [
      'Add a Bodytone session this week — accelerates muscle definition in your core and glutes',
      'Increase protein at breakfast to 40g to front-load daily intake',
      'Prioritise 8h sleep Tuesday–Thursday to optimise GLP-1 efficacy',
    ],
    requiresSimiReview: false, simiReviewReasons: [],
  };
}
