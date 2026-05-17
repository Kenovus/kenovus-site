import type { ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/constants/designSystem';

type VisualizerProps = {
  bodyFatPercent: number;
};

type FallbackProps = {
  latest: number | null;
  prior: number | null;
  delta: number | null;
};

let Visualizer3D: ComponentType<VisualizerProps> | null = null;

try {
  // no static import: prevents Expo Go crashes when expo-gl native module is unavailable.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const loaded = require('@/components/patient/BodyFatVisualizer3D') as {
    BodyFatVisualizer3D?: ComponentType<VisualizerProps>;
  };
  Visualizer3D = loaded.BodyFatVisualizer3D ?? null;
} catch {
  Visualizer3D = null;
}

export const hasBodyFat3D = Boolean(Visualizer3D);
export const SafeBodyFatVisualizer3D = Visualizer3D;

function fmtPercent(v: number | null): string {
  return typeof v === 'number' && Number.isFinite(v) ? `${v.toFixed(1)}%` : '--';
}

export function BodyFatVisualizer2DFallback({ latest, prior, delta }: FallbackProps) {
  const pct = typeof latest === 'number' ? Math.max(5, Math.min(55, latest)) : null;
  const torsoWidth = pct == null ? 96 : 78 + (pct - 5) * 1.2;
  const hipsWidth = pct == null ? 108 : 88 + (pct - 5) * 1.35;

  return (
    <View style={styles.wrap}>
      <View style={styles.figure}>
        <View style={styles.head} />
        <View style={[styles.torso, { width: torsoWidth }]} />
        <View style={[styles.hips, { width: hipsWidth }]} />
        <View style={styles.legsRow}>
          <View style={styles.leg} />
          <View style={styles.leg} />
        </View>
      </View>
      <Text style={styles.caption}>3D view requires a dev build. Showing 2D proxy in Expo Go.</Text>
      <View style={styles.statsRow}>
        <Text style={styles.stat}>Latest: {fmtPercent(latest)}</Text>
        <Text style={styles.stat}>Prior: {fmtPercent(prior)}</Text>
        <Text style={styles.stat}>Delta: {delta == null ? '--' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 10,
    backgroundColor: '#0f1117',
  },
  figure: { alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  head: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: 'rgba(201,168,76,0.14)',
    marginBottom: 8,
  },
  torso: {
    height: 90,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: 'rgba(201,168,76,0.12)',
    marginBottom: 6,
  },
  hips: {
    height: 46,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: 'rgba(201,168,76,0.1)',
    marginBottom: 8,
  },
  legsRow: { flexDirection: 'row', gap: 10 },
  leg: {
    width: 22,
    height: 68,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: 'rgba(201,168,76,0.08)',
  },
  caption: { ...typography.body, color: colors.gray1, textAlign: 'center', fontSize: 13 },
  statsRow: { alignItems: 'center', gap: 4 },
  stat: { ...typography.body, color: colors.white, fontSize: 14 },
});
