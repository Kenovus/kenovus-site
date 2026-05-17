import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

type Props = { color: string; size?: number; listening?: boolean };

/**
 * Sparkles tab icon; gently pulses when Sona is listening to speech input.
 */
export function SonaTabBarIcon({ color, size = 24, listening = false }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!listening) {
      Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.1, duration: 600, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [listening, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons name="sparkles" color={color} size={size} />
    </Animated.View>
  );
}
