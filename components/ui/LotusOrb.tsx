import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';

const GOLD = '#BF8D36';

// Aspect ratio of the cropped lotus-gold.png (1536 × 591)
const LOTUS_RATIO = 591 / 1536;

// Glow dot at angle (degrees) on a ring of radius r, centred at (cx, cy)
function GlowDot({ angle, r, cx, cy, size = 7, color }: {
  angle: number; r: number; cx: number; cy: number; size?: number; color: string;
}) {
  const rad = (angle * Math.PI) / 180;
  return (
    <View style={{
      position: 'absolute',
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color,
      left: cx + Math.sin(rad) * r - size / 2,
      top:  cy - Math.cos(rad) * r - size / 2,
      shadowColor: color, shadowOpacity: 0.95,
      shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
      elevation: 4,
    }} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
type Props = {
  isListening?: boolean;
  isDark?: boolean;
  size?: number;
};

export function LotusOrb({ isListening = false, isDark = true, size = 220 }: Props) {
  const breath      = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const dur = isListening ? 650 : 2800;
    const amp = isListening ? 1.10 : 1.05;

    const bLoop = Animated.loop(Animated.sequence([
      Animated.timing(breath,      { toValue: amp,                   duration: dur,       easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breath,      { toValue: 1,                     duration: dur,       easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const gLoop = Animated.loop(Animated.sequence([
      Animated.timing(glowOpacity, { toValue: isListening ? 0.9 : 0.70, duration: dur * 1.1, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(glowOpacity, { toValue: 0.30,                      duration: dur * 1.1, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    bLoop.start();
    gLoop.start();
    return () => { bLoop.stop(); gLoop.stop(); };
  }, [isListening, breath, glowOpacity]);

  const cx = size / 2;
  const cy = size / 2;
  const outerR  = size * 0.46;
  const midR    = size * 0.35;
  const innerR  = size * 0.23;
  const innerD  = innerR * 2;
  const innerOff = cx - innerR;

  // Scale lotus so it visually fills the inner ring.
  // Width overflows the ring; circular overflow:hidden clips it naturally.
  const lotusW = innerD * 1.8;
  const lotusH = lotusW * LOTUS_RATIO;

  const ringColor = GOLD;
  const innerGlow = isDark ? 'rgba(191,141,54,0.16)' : 'rgba(191,141,54,0.10)';

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ scale: breath }] }}>

      {/* Outer ring — thin, 4 cardinal glow dots */}
      <View style={[ss.ring, { width: size, height: size, borderRadius: size / 2, borderColor: ringColor + '55' }]}>
        {[0, 90, 180, 270].map((a) => (
          <GlowDot key={a} angle={a} r={outerR} cx={cx} cy={cy} size={8} color={ringColor} />
        ))}
      </View>

      {/* Middle ring — 6 glow dots, breathes with opacity */}
      <Animated.View style={[ss.ring, {
        width: size * 0.72, height: size * 0.72,
        borderRadius: (size * 0.72) / 2,
        borderColor: ringColor + '90', borderWidth: 1.2,
        top: cx - size * 0.36, left: cy - size * 0.36,
        opacity: glowOpacity,
      }]}>
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <GlowDot key={a} angle={a} r={midR} cx={size * 0.36} cy={size * 0.36} size={5} color={ringColor} />
        ))}
      </Animated.View>

      {/* Inner glow fill */}
      <Animated.View style={{
        position: 'absolute',
        width: innerD, height: innerD, borderRadius: innerR,
        backgroundColor: innerGlow,
        top: innerOff, left: innerOff,
        opacity: glowOpacity,
      }} />

      {/* Inner solid ring + lotus image centred inside */}
      <View style={[ss.ring, {
        width: innerD, height: innerD, borderRadius: innerR,
        borderColor: ringColor, borderWidth: 2.5,
        backgroundColor: 'rgba(191,141,54,0.04)',
        top: innerOff, left: innerOff,
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }]}>
        <Image
          source={require('../../assets/images/lotus-gold.png')}
          style={{ width: lotusW, height: lotusH }}
          resizeMode="contain"
        />
      </View>

    </Animated.View>
  );
}

const ss = StyleSheet.create({
  ring: { position: 'absolute', borderWidth: 1 },
});
