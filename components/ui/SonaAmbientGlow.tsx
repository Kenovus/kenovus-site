/**
 * SonaAmbientGlow — rotating multi-color Siri-style edge glow.
 *
 * Three colored spotlights (Gold · Teal · Purple) travel clockwise around the
 * screen perimeter simultaneously, each separated by 120°. The net effect is
 * a slowly rotating rainbow that makes the screen feel alive — matching the
 * iPhone Siri glow reference.
 *
 * Implementation: one shared Animated.Value cycles 0→1 in 12 s (full revolution).
 * For each of the 4 edges × 3 spotlights, we interpolate the opacity from this
 * single value using phase-shifted keyframes so each spotlight appears bright
 * on each edge exactly once per revolution.
 *
 * A subtle full-screen interior gradient breathes in sync to give the screen
 * interior an "alive" quality (low opacity, barely perceptible).
 */
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SW, height: SH } = Dimensions.get('window');

// ── Visual constants ───────────────────────────────────────────────────────────
const THICK = 28;    // glow strip width — thin, elegant
const CYCLE = 12000; // ms for full revolution

// Spotlight colors — reduced opacity for subtlety
const GOLD_COLORS:   [string, string, string] = ['rgba(255,195,45,0.70)',  'rgba(220,150,20,0.18)', 'transparent'];
const TEAL_COLORS:   [string, string, string] = ['rgba(0,215,195,0.65)',   'rgba(0,170,160,0.14)', 'transparent'];
const PURPLE_COLORS: [string, string, string] = ['rgba(175,65,245,0.60)',  'rgba(135,45,210,0.12)', 'transparent'];
const BASE_COLORS:   [string, string, string] = ['rgba(200,175,90,0.18)',  'rgba(180,155,60,0.05)', 'transparent'];

// Gradient directions per edge (bright AT edge, fading inward)
const DIR = {
  top:    { start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
  bottom: { start: { x: 0, y: 1 }, end: { x: 0, y: 0 } },
  left:   { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
  right:  { start: { x: 1, y: 0 }, end: { x: 0, y: 0 } },
};

// ── Phase math ─────────────────────────────────────────────────────────────────
// The cycle value 0→1 represents the angle of the Gold spotlight.
// Spotlight positions around the perimeter: top≈0.125, right≈0.375, bottom≈0.625, left≈0.875
// Gold starts at 0, Teal at 0.333, Purple at 0.667.
// A spotlight illuminates an edge when its perimeter position passes through that edge's zone.

const EDGE_CENTERS = { top: 0.125, right: 0.375, bottom: 0.625, left: 0.875 };
const SPOT_OFFSETS = { gold: 0, teal: 0.333, purple: 0.667 };
const WIDTH = 0.19; // half-width of bright zone per spotlight per edge

// Given the cycle value when a spotlight (at spotOffset) is brightest at an edge,
// return the center phase c = (edgeCenter - spotOffset + 1) mod 1
function phaseCenter(edgeCenter: number, spotOffset: number) {
  return ((edgeCenter - spotOffset) % 1 + 1) % 1;
}

// Build interpolation keyframes for a spotlight at given phase center.
// The opacity rises to maxOp at c, then falls back to 0 on both sides.
function buildInterp(cycle: Animated.Value, c: number, maxOp = 0.90): Animated.AnimatedInterpolation<number> {
  const lo = c - WIDTH;
  const hi = c + WIDTH;

  if (lo >= 0 && hi <= 1) {
    // No wraparound
    return cycle.interpolate({
      inputRange:  [0,    Math.max(0, lo - 0.06),  c,     Math.min(1, hi + 0.06), 1],
      outputRange: [0,    0,                         maxOp, 0,                     0],
      extrapolate: 'clamp',
    });
  } else if (lo < 0) {
    // Wraps at 0
    const wrapLo = lo + 1; // equivalent lower bound on the 1-side
    return cycle.interpolate({
      inputRange:  [0,    hi,    hi + 0.06, wrapLo - 0.06, wrapLo, 1],
      outputRange: [maxOp, maxOp,  0,         0,              maxOp,  maxOp],
      extrapolate: 'clamp',
    });
  } else {
    // Wraps at 1
    const wrapHi = hi - 1; // equivalent upper bound on the 0-side
    return cycle.interpolate({
      inputRange:  [0,      wrapHi,  wrapHi + 0.06, lo - 0.06, lo,    1],
      outputRange: [maxOp,  maxOp,   0,              0,          maxOp, maxOp],
      extrapolate: 'clamp',
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
type Props = { visible: boolean };

export function SonaAmbientGlow({ visible }: Props) {
  const cycle   = useRef(new Animated.Value(0)).current; // rotation 0→1
  const breathe = useRef(new Animated.Value(0.5)).current; // base breathe
  const enter   = useRef(new Animated.Value(0)).current;   // fade in/out

  useEffect(() => {
    if (!visible) {
      Animated.timing(enter, { toValue: 0, duration: 800, useNativeDriver: true }).start();
      return;
    }

    // Fade in
    Animated.timing(enter, { toValue: 1, duration: 500, useNativeDriver: true }).start();

    // Slow clockwise rotation
    cycle.setValue(0);
    const rot = Animated.loop(
      Animated.timing(cycle, { toValue: 1, duration: CYCLE, easing: Easing.linear, useNativeDriver: true }),
    );

    // Slow base breathe for depth
    const br = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1.0, duration: 3500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0.3, duration: 3500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    rot.start(); br.start();
    return () => { rot.stop(); br.stop(); };
  }, [visible, cycle, breathe, enter]);

  if (!visible) return null;

  // Pre-compute all 12 interpolations (4 edges × 3 spotlights)
  type EdgeKey = 'top' | 'bottom' | 'left' | 'right';
  const edges: EdgeKey[] = ['top', 'bottom', 'left', 'right'];
  const spots = [
    { name: 'gold',   offset: SPOT_OFFSETS.gold,   colors: GOLD_COLORS   },
    { name: 'teal',   offset: SPOT_OFFSETS.teal,   colors: TEAL_COLORS   },
    { name: 'purple', offset: SPOT_OFFSETS.purple,  colors: PURPLE_COLORS },
  ] as const;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: enter }]} pointerEvents="none">

      {/* Interior ambient glow — barely perceptible, adds "alive" color to screen */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: breathe }]}>
        <LinearGradient
          colors={['rgba(0,190,180,0.03)', 'transparent', 'rgba(160,55,235,0.025)']}
          start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Edge strips — base always-on warmth */}
      {edges.map((e) => (
        <View key={`base-${e}`} style={[ss.edge, ss[e]]}>
          <LinearGradient colors={BASE_COLORS} start={DIR[e].start} end={DIR[e].end} style={StyleSheet.absoluteFill} />
        </View>
      ))}

      {/* Rotating color spotlights */}
      {edges.map((e) =>
        spots.map((s) => {
          const c   = phaseCenter(EDGE_CENTERS[e], s.offset);
          const op  = buildInterp(cycle, c, 1.0);
          return (
            <Animated.View key={`${e}-${s.name}`} style={[ss.edge, ss[e], { opacity: op }]}>
              <LinearGradient colors={s.colors} start={DIR[e].start} end={DIR[e].end} style={StyleSheet.absoluteFill} />
            </Animated.View>
          );
        })
      )}

    </Animated.View>
  );
}

const ss = StyleSheet.create({
  edge:   { position: 'absolute' },
  top:    { top: 0,    left: 0, right: 0,  height: THICK },
  bottom: { bottom: 0, left: 0, right: 0,  height: THICK },
  left:   { top: 0, bottom: 0, left: 0,   width:  THICK },
  right:  { top: 0, bottom: 0, right: 0,  width:  THICK },
});
