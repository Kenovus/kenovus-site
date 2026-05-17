import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/constants/designSystem';

/** Temporary: opens Google search for the business listing (review URL TBD). */
const REVIEW_URL =
  'https://www.google.com/search?q=Sona+Medical+Aesthetics+Newcastle+WA';

type Props = {
  onDismiss: () => void;
};

export function GoogleReviewPromptCard({ onDismiss }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Loving SonaLife?</Text>
      <Text style={styles.body}>Help Sona grow — leave us a review on Google 🌟</Text>
      <Pressable
        onPress={() => {
          void Linking.openURL(REVIEW_URL);
        }}
        style={styles.cta}>
        <Text style={styles.ctaText}>Open Google review</Text>
      </Pressable>
      <Pressable onPress={onDismiss} style={styles.dismiss}>
        <Text style={styles.dismissText}>Not now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: 'rgba(201,168,76,0.12)',
    padding: 16,
    marginBottom: 16,
  },
  title: {
    ...typography.h2,
    color: colors.white,
    marginBottom: 8,
    fontSize: 20,
  },
  body: {
    ...typography.body,
    color: colors.gray1,
    lineHeight: 22,
    marginBottom: 14,
  },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: colors.gold,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    marginBottom: 10,
  },
  ctaText: {
    fontFamily: 'Jost_300Light',
    color: colors.dark,
    fontSize: 15,
    fontWeight: '600',
  },
  dismiss: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  dismissText: {
    ...typography.body,
    color: colors.gray2,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
