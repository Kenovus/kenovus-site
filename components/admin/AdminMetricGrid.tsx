import type { ReactNode } from 'react';
import { Children, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

/** Matches admin screen ScrollView `contentContainerStyle` horizontal padding. */
const ADMIN_H_PADDING = 20;
const COLUMN_GAP = 10;

type Props = { children: ReactNode };

/**
 * Two-column metric layout: equal-width cells, wraps to 2×2 for four cards.
 */
export function AdminMetricGrid({ children }: Props) {
  const { width } = useWindowDimensions();
  const cellWidth = useMemo(() => {
    const inner = width - ADMIN_H_PADDING * 2;
    return Math.max(0, (inner - COLUMN_GAP) / 2);
  }, [width]);

  return (
    <View style={styles.row}>
      {Children.map(children, (child, index) =>
        child != null && child !== false ? (
          <View key={index} style={[styles.cell, { width: cellWidth }]}>
            {child}
          </View>
        ) : null,
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: COLUMN_GAP,
  },
  cell: {
    minHeight: 124,
    flexDirection: 'column',
  },
});
