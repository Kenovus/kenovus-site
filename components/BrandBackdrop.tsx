import { useId } from 'react';
import { useWindowDimensions, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * Subtle studio radial behind the wordmark and a sparse line-and-node constellation.
 * Assumes parent background is colors.dark (#0D0F12).
 */
export function BrandBackdrop() {
  const glowId = `kenGlow_${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { width: W, height: H } = useWindowDimensions();

  const n = [
    { x: W * 0.14, y: H * 0.12 },
    { x: W * 0.38, y: H * 0.1 },
    { x: W * 0.62, y: H * 0.14 },
    { x: W * 0.84, y: H * 0.11 },
    { x: W * 0.48, y: H * 0.2 },
  ] as const;

  const line = 'rgba(218,224,232,0.14)';
  const node = 'rgba(201,168,76,0.4)';

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={glowId} cx="50%" cy="34%" rx="58%" ry="32%" fy="32%" fx="50%">
            <Stop offset="0" stopColor="rgba(201,168,76,0.12)" />
            <Stop offset="0.42" stopColor="rgba(201,168,76,0.035)" />
            <Stop offset="1" stopColor="rgba(13,15,18,0)" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill={`url(#${glowId})`} />

        <Line x1={n[0].x} y1={n[0].y} x2={n[1].x} y2={n[1].y} stroke={line} strokeWidth={0.7} />
        <Line x1={n[1].x} y1={n[1].y} x2={n[4].x} y2={n[4].y} stroke={line} strokeWidth={0.7} />
        <Line x1={n[2].x} y1={n[2].y} x2={n[4].x} y2={n[4].y} stroke={line} strokeWidth={0.7} />
        <Line x1={n[2].x} y1={n[2].y} x2={n[3].x} y2={n[3].y} stroke={line} strokeWidth={0.7} />

        {n.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={1.6} fill={node} />
        ))}
      </Svg>
    </View>
  );
}
