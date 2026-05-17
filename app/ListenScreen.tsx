import React, { useEffect, useRef } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  Platform, Animated, Easing,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

// Pass dark={true} for dark mode, dark={false} (default) for light mode
interface ListenScreenProps {
  dark?: boolean;
  navigation?: any;
}

const ASSETS_LIGHT = require('../assets/images/sona-light-bg.png');
const ASSETS_DARK  = require('../assets/images/sona-bg-dark.png');

const GOLD = '#c9a84c';

function LotusGold({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={Math.round(size * 0.82)} viewBox="0 0 80 65" fill="none" stroke={GOLD} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M40 10C40 10 30 22 20 24C25 16 35 8 40 10Z"/>
      <Path d="M40 10C40 10 50 22 60 24C55 16 45 8 40 10Z"/>
      <Path d="M40 10C40 10 28 30 18 40C22 28 34 14 40 10Z"/>
      <Path d="M40 10C40 10 52 30 62 40C58 28 46 14 40 10Z"/>
      <Path d="M28 48C32 42 38 39 40 39C42 39 48 42 52 48"/>
    </Svg>
  );
}

export default function ListenScreen({ dark = false, navigation }: ListenScreenProps) {
  const TC   = dark ? '#ffffff' : '#2a1e10';
  const TC2  = dark ? 'rgba(255,255,255,0.45)' : '#9a826a';
  const bgSrc = dark ? ASSETS_DARK : ASSETS_LIGHT;
  const ringGlow   = dark ? 'rgba(212,175,55,0.55)' : 'rgba(212,175,55,0.38)';
  const ringStroke = dark ? 'rgba(212,175,55,0.85)' : 'rgba(180,140,40,0.78)';
  const innerBg    = dark ? 'rgba(20,22,28,0.88)' : 'rgba(245,238,228,0.92)';
  const stopBg     = dark ? 'rgba(255,255,255,0.12)' : 'rgba(180,155,120,0.28)';
  const typeBg     = dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.78)';
  const typeBdr    = dark ? 'rgba(255,255,255,0.12)' : 'rgba(180,155,120,0.38)';

  // Breathing animations
  const scale1 = useRef(new Animated.Value(1)).current;
  const scale2 = useRef(new Animated.Value(1)).current;
  const scale3 = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Ring 1 — innermost (lotus circle)
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale1, { toValue: 1.06, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(scale1, { toValue: 1.00, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    // Ring 2 — mid ring, slightly offset
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale2, { toValue: 1.10, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(scale2, { toValue: 1.00, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    // Ring 3 — outer ring
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale3, { toValue: 1.14, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(scale3, { toValue: 1.00, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    // Waveform loop
    Animated.loop(
      Animated.timing(waveAnim, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: false })
    ).start();

    return () => {
      scale1.stopAnimation();
      scale2.stopAnimation();
      scale3.stopAnimation();
      waveAnim.stopAnimation();
    };
  }, []);

  // 12 waveform bars — heights oscillate
  const BARS = 12;

  return (
    <View style={s.container}>
      <Image source={bgSrc} style={s.bg} resizeMode="cover"/>
      {dark && <View style={s.darkOverlay}/>}

      {/* Header */}
      <View style={[s.header, { paddingTop: Platform.OS === 'ios' ? 54 : 40 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation?.goBack()}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={TC} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 18l-6-6 6-6"/>
          </Svg>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <LotusGold size={36}/>
          <Text style={[s.headerTitle, { color: TC }]}>SONA</Text>
          <Text style={[s.headerSub, { color: TC2 }]}>AI Coach</Text>
        </View>
        <View style={{ width: 36 }}/>
      </View>

      {/* Title */}
      <Text style={[s.listening, { color: TC }]}>Listening...</Text>
      <Text style={[s.subtitle, { color: TC2 }]}>How can I help you?</Text>

      {/* Breathing lotus orb */}
      <View style={s.orbArea}>

        {/* Outer ring */}
        <Animated.View style={[
          s.ring,
          { width: 200, height: 200, borderRadius: 100, borderColor: ringGlow, backgroundColor: dark ? 'rgba(180,140,40,0.08)' : 'rgba(212,175,55,0.08)' },
          { transform: [{ scale: scale3 }] },
        ]}/>

        {/* Mid ring with glint dots */}
        <Animated.View style={[
          s.ring,
          { width: 158, height: 158, borderRadius: 79, borderColor: ringStroke, backgroundColor: 'transparent' },
          { transform: [{ scale: scale2 }] },
        ]}>
          {/* 6 glint dots around the ring */}
          {[0, 60, 120, 180, 240, 300].map(deg => {
            const rad = (deg * Math.PI) / 180;
            const r = 79;
            const x = r + r * Math.cos(rad) - 3;
            const y = r + r * Math.sin(rad) - 3;
            return (
              <View key={deg} style={[s.glint, { left: x, top: y }]}/>
            );
          })}
        </Animated.View>

        {/* Inner lotus circle */}
        <Animated.View style={[
          s.innerCircle,
          { backgroundColor: innerBg, borderColor: ringGlow },
          { transform: [{ scale: scale1 }] },
        ]}>
          <LotusGold size={52}/>
        </Animated.View>

        {/* Waveform bars (positioned across mid ring) */}
        <View style={s.waveRow} pointerEvents="none">
          {Array.from({ length: BARS }, (_, i) => {
            const height = waveAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [6 + (i % 4) * 5, 22 - (i % 3) * 4],
            });
            return (
              <Animated.View key={i} style={[s.waveBar, { height }]}/>
            );
          })}
        </View>

      </View>

      {/* Stop button */}
      <TouchableOpacity style={[s.stopBtn, { backgroundColor: stopBg, borderColor: ringGlow }]} onPress={() => navigation?.goBack()}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill={TC}>
          <Path d="M6 6h12v12H6z"/>
        </Svg>
      </TouchableOpacity>

      {/* Type instead */}
      <TouchableOpacity style={[s.typeBtn, { backgroundColor: typeBg, borderColor: typeBdr }]} onPress={() => navigation?.navigate('Chat')}>
        {/* Keyboard icon */}
        <Svg width={14} height={12} viewBox="0 0 14 12" fill="none">
          {[0, 3, 6, 9, 12].map(x => (
            <Path key={x} d={`M${x} 0v12`} stroke={TC} strokeWidth={1.5} strokeLinecap="round"/>
          ))}
        </Svg>
        <Text style={[s.typeTxt, { color: TC }]}>Type instead</Text>
      </TouchableOpacity>

      {/* Tips */}
      <Text style={[s.tips, { color: TC2 }]}>
        Tips: Try "Log my lunch" or{'\n'}"What should I eat?"
      </Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:   { flex: 1, alignItems: 'center', backgroundColor: '#F5EDE4' },
  bg:          { position: 'absolute', inset: 0, width: '100%', height: '100%' } as any,
  darkOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(10,12,15,0.75)' } as any,

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 16, paddingBottom: 4 },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerCenter:{ alignItems: 'center' },
  headerTitle: { fontFamily: 'Cormorant-SemiBold', fontSize: 16, letterSpacing: 3.5, lineHeight: 18, marginTop: 2 },
  headerSub:   { fontFamily: 'DMSans-Regular', fontSize: 9, letterSpacing: 2.5 },

  listening:   { fontFamily: 'Cormorant-Regular', fontSize: 27, marginTop: 22, letterSpacing: 0.5 },
  subtitle:    { fontFamily: 'DMSans-Regular', fontSize: 13, marginTop: 4, marginBottom: 30, letterSpacing: 0.2 },

  // Orb area
  orbArea:     { width: 210, height: 210, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  ring:        { position: 'absolute', borderWidth: 1.5 },
  glint:       { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD, opacity: 0.75 },
  innerCircle: { width: 110, height: 110, borderRadius: 55, borderWidth: 2, alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  waveRow:     { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 4, opacity: 0.6 },
  waveBar:     { width: 3, borderRadius: 99, backgroundColor: GOLD },

  stopBtn:     { marginTop: 30, width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  typeBtn:     { marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28, borderWidth: 1 },
  typeTxt:     { fontFamily: 'DMSans-Medium', fontSize: 13 },
  tips:        { fontFamily: 'DMSans-Regular', fontSize: 11, textAlign: 'center', marginTop: 20, lineHeight: 18, paddingHorizontal: 28 },
});
