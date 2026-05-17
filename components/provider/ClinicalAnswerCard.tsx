import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/constants/designSystem';
import type { ClinicalInsightResponse } from '@/lib/clinicalInsights';

export function ClinicalAnswerCard({ response }: { response: ClinicalInsightResponse }) {
  return (
    <View style={styles.card}>
      <Text style={styles.h}>CLINICAL ANSWER</Text>
      <Text style={styles.p}>{response.clinical_answer}</Text>

      <Text style={styles.h}>CONFIDENCE LEVEL</Text>
      <Text style={styles.conf}>{response.confidence_level}</Text>

      <Text style={styles.h}>KEY FINDINGS</Text>
      {response.key_findings.map((f, i) => (
        <Text key={`${i}-${f}`} style={styles.b}>
          • {f}
        </Text>
      ))}

      <Text style={styles.h}>CLINICAL APPLICATION</Text>
      <Text style={styles.p}>{response.clinical_application}</Text>

      {response.specialty_note ? (
        <>
          <Text style={styles.h}>SPECIALTY NOTE</Text>
          <Text style={styles.p}>{response.specialty_note}</Text>
        </>
      ) : null}

      <Text style={styles.disclaimer}>{response.disclaimer}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 14,
    backgroundColor: colors.darkCard,
    padding: 14,
    marginBottom: 12,
  },
  h: { ...typography.label, color: colors.gold, marginBottom: 6, marginTop: 8 },
  p: { ...typography.body, color: colors.white, fontSize: 14, lineHeight: 21 },
  conf: { ...typography.body, color: colors.goldLight, fontWeight: '700', fontSize: 14 },
  b: { ...typography.body, color: colors.gray1, fontSize: 14, lineHeight: 20 },
  disclaimer: {
    ...typography.body,
    color: colors.gray2,
    fontSize: 12,
    marginTop: 12,
    fontStyle: 'italic',
  },
});
