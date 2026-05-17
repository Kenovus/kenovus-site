import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export type SonaVoiceVisualState = 'inactive' | 'listening' | 'thinking' | 'speaking';

const GOLD = '#c9a84c';
const GOLD_OUTER = 'rgba(201,168,76,0.3)';

type Props = {
  state: SonaVoiceVisualState;
  onPress: () => void;
  size?: 'default' | 'hero';
  disabled?: boolean;
};

/**
 * Gold voice control: tap to start/stop listening. Visual states for listening, thinking, and speaking.
 */
export function SonaVoiceButton({ state, onPress, size = 'default', disabled }: Props) {
  const isHero = size === 'hero';
  const base = isHero ? 120 : 60;
  const pulse = useRef(new Animated.Value(0)).current;
  const heroInnerPulse = useRef(new Animated.Value(0)).current;
  const heroMidPulse = useRef(new Animated.Value(0)).current;
  const heroOuterPulse = useRef(new Animated.Value(0)).current;
  const heroOrbit = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state === 'listening') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(0);
  }, [state, pulse]);

  useEffect(() => {
    if (!(isHero && state === 'listening')) {
      heroInnerPulse.setValue(0);
      heroMidPulse.setValue(0);
      heroOuterPulse.setValue(0);
      heroOrbit.setValue(0);
      return;
    }

    const easing = Easing.inOut(Easing.sin);

    const makeBreath = (anim: Animated.Value, duration: number, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration, easing, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration, easing, useNativeDriver: true }),
        ]),
      );

    const innerLoop = makeBreath(heroInnerPulse, 1800, 0);
    const midLoop = makeBreath(heroMidPulse, 2200, 180);
    const outerLoop = makeBreath(heroOuterPulse, 2600, 360);
    const orbitLoop = Animated.loop(
      Animated.timing(heroOrbit, { toValue: 1, duration: 5200, easing: Easing.linear, useNativeDriver: true }),
    );

    innerLoop.start();
    midLoop.start();
    outerLoop.start();
    orbitLoop.start();

    return () => {
      innerLoop.stop();
      midLoop.stop();
      outerLoop.stop();
      orbitLoop.stop();
    };
  }, [isHero, state, heroInnerPulse, heroMidPulse, heroOuterPulse, heroOrbit]);

  const listeningScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.85] });

  const activeSize = state === 'listening' && !isHero ? 80 : base;

  if (isHero && state === 'listening') {
    const innerScale = heroInnerPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
    const midScale = heroMidPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
    const outerScale = heroOuterPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
    const lotusScale = heroInnerPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
    const orbitRotation = heroOrbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={[styles.wrap, styles.heroWrap]}
        accessibilityLabel="Stop listening">
        <View style={styles.heroWaveSideLeft}>
          <WaveBar />
          <WaveBar phase={110} />
          <WaveBar phase={220} />
        </View>

        <View style={styles.heroCore}>
          <Animated.View style={[styles.heroGlow, { transform: [{ scale: outerScale }] }]} />
          <Animated.View style={[styles.heroRingOuter, { transform: [{ scale: outerScale }] }]} />
          <Animated.View style={[styles.heroRingMid, { transform: [{ scale: midScale }] }]} />
          <Animated.View style={[styles.heroRingInner, { transform: [{ scale: innerScale }] }]} />

          <Animated.View style={[styles.heroOrbit, { transform: [{ rotate: orbitRotation }] }]}>
            <View style={[styles.heroGlintDot, styles.heroGlintDotTop]} />
            <View style={[styles.heroGlintDot, styles.heroGlintDotRight]} />
            <View style={[styles.heroGlintDot, styles.heroGlintDotBottom]} />
          </Animated.View>

          <Animated.View style={[styles.heroLotusWrap, { transform: [{ scale: lotusScale }] }]}>
            <LotusIcon />
          </Animated.View>
        </View>

        <View style={styles.heroWaveSideRight}>
          <WaveBar phase={80} />
          <WaveBar phase={190} />
          <WaveBar phase={300} />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.wrap, { width: activeSize + 24, height: activeSize + 24 }]}
      accessibilityLabel={state === 'listening' ? 'Stop listening' : 'Start listening to Sona'}>
      {state === 'listening' ? (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              width: activeSize + 16,
              height: activeSize + 16,
              borderRadius: (activeSize + 16) / 2,
              opacity: ringOpacity,
              transform: [{ scale: listeningScale }],
            },
          ]}
        />
      ) : null}

      <View
        style={[
          styles.inner,
          {
            width: activeSize,
            height: activeSize,
            borderRadius: activeSize / 2,
          },
        ]}>
        {state === 'thinking' ? (
          <ActivityIndicator color="#241B0A" size={isHero ? 'large' : 'small'} />
        ) : state === 'speaking' ? (
          <View style={styles.waveRow}>
            <WaveBar />
            <WaveBar phase={120} />
            <WaveBar phase={240} />
          </View>
        ) : (
          <Text style={styles.icon}>{isHero ? '✨' : '✨'}</Text>
        )}
      </View>
    </Pressable>
  );
}

function LotusIcon() {
  return (
    <Svg width={56} height={56} viewBox="0 0 56 56" fill="none">
      <Path d="M28 39.5c4.6-3.6 7.2-8.2 7.2-13.1-3.3 1.6-5.8 4.2-7.2 7.4-1.4-3.2-3.9-5.8-7.2-7.4 0 4.9 2.6 9.5 7.2 13.1z" fill={GOLD} />
      <Path d="M16 33.2c4.2-.6 7.7-2.6 10.2-5.6-2.9-1.5-6.3-2-9.8-1.3.4 2.4 1.5 4.8 3.6 6.9z" fill={GOLD} fillOpacity={0.92} />
      <Path d="M40 33.2c-4.2-.6-7.7-2.6-10.2-5.6 2.9-1.5 6.3-2 9.8-1.3-.4 2.4-1.5 4.8-3.6 6.9z" fill={GOLD} fillOpacity={0.92} />
      <Path d="M28 23.4c2.6-2.2 4-4.8 4-7.4-2 .9-3.3 2.2-4 3.9-.7-1.7-2-3-4-3.9 0 2.6 1.4 5.2 4 7.4z" fill={GOLD} fillOpacity={0.85} />
      <Path d="M20 41.4h16" stroke={GOLD} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function WaveBar({ phase = 0 }: { phase?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const t = setTimeout(() => {
      const loop = Animated.loop(
        Animated.timing(a, { toValue: 1, duration: 500 + (phase % 3) * 80, useNativeDriver: true }),
      );
      loop.start();
    }, phase);
    return () => {
      clearTimeout(t);
    };
  }, [a, phase]);
  const scaleY = a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 1, 0.4] });
  return (
    <Animated.View
      style={{
        width: 5,
        height: 20,
        marginHorizontal: 2,
        backgroundColor: '#241B0A',
        borderRadius: 2,
        transform: [{ scaleY }],
      }}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  heroWrap: { width: 320, height: 230, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  heroCore: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  heroGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(201,168,76,0.15)',
  },
  heroRingInner: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: GOLD,
  },
  heroRingMid: {
    position: 'absolute',
    width: 155,
    height: 155,
    borderRadius: 77.5,
    borderWidth: 1.5,
    borderColor: GOLD,
    opacity: 0.85,
  },
  heroRingOuter: {
    position: 'absolute',
    width: 195,
    height: 195,
    borderRadius: 97.5,
    borderWidth: 1,
    borderColor: GOLD,
    opacity: 0.45,
  },
  heroOrbit: {
    position: 'absolute',
    width: 155,
    height: 155,
    borderRadius: 77.5,
  },
  heroGlintDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GOLD,
    shadowColor: GOLD,
    shadowOpacity: 0.45,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  heroGlintDotTop: { top: -3, left: 74.5 },
  heroGlintDotRight: { top: 74.5, right: -3 },
  heroGlintDotBottom: { bottom: -3, left: 74.5 },
  heroLotusWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(201,168,76,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroWaveSideLeft: { width: 38, marginRight: 6, alignItems: 'center', justifyContent: 'center' },
  heroWaveSideRight: { width: 38, marginLeft: 6, alignItems: 'center', justifyContent: 'center' },
  pulseRing: {
    position: 'absolute',
    backgroundColor: GOLD_OUTER,
  },
  inner: {
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 24, lineHeight: 28 },
  waveRow: { flexDirection: 'row', alignItems: 'flex-end', height: 28, justifyContent: 'center' },
});
