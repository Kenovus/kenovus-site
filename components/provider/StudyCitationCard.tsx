import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/constants/designSystem';
import type { StudyCitation } from '@/lib/clinicalInsights';

export function StudyCitationCard({
  idx,
  study,
  onBookmark,
}: {
  idx: number;
  study: StudyCitation;
  onBookmark?: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        {idx + 1}. {study.title}
      </Text>
      <Text style={styles.meta}>
        {study.authors} · {study.journal} · {study.year}
      </Text>
      <Text style={styles.finding}>{study.finding}</Text>
      <View style={styles.row}>
        <Pressable onPress={() => void Linking.openURL(study.pubmed_url)}>
          <Text style={styles.link}>PubMed</Text>
        </Pressable>
        {study.doi ? <Text style={styles.meta}>DOI: {study.doi}</Text> : null}
        {onBookmark ? (
          <Pressable onPress={onBookmark}>
            <Text style={styles.link}>Bookmark</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.darkCard,
    marginBottom: 10,
  },
  title: { ...typography.body, color: colors.white, fontWeight: '600', fontSize: 16 },
  meta: { ...typography.body, color: colors.gray2, fontSize: 12, marginTop: 4 },
  finding: { ...typography.body, color: colors.gray1, fontSize: 14, marginTop: 8, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 12, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' },
  link: { ...typography.body, color: colors.goldLight, fontSize: 13, textDecorationLine: 'underline' },
});
