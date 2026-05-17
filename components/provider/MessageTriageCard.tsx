import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import type { TriageLayer } from '@/lib/triage';

type Props = {
  patientName: string;
  question: string;
  aiDraft: string | null;
  confidenceScore: number;
  layer: TriageLayer;
  escalationReason: string | null;
  emergencyBadge?: string | null;
  onSendDraft: () => void;
  onEditSend: () => void;
  onEscalate: () => void;
};

export function MessageTriageCard({
  patientName,
  question,
  aiDraft,
  confidenceScore,
  layer,
  escalationReason,
  emergencyBadge,
  onSendDraft,
  onEditSend,
  onEscalate,
}: Props) {
  const urgent = layer === 3;
  return (
    <View style={[styles.card, urgent && styles.urgentCard]}>
      <Text style={styles.patient}>{patientName}</Text>
      <Text style={styles.question}>"{question}"</Text>
      {emergencyBadge ? <Text style={styles.badge}>{emergencyBadge}</Text> : null}
      <Text style={styles.meta}>
        Layer {layer} · confidence {(confidenceScore * 100).toFixed(0)}%
        {escalationReason ? ` · ${escalationReason}` : ''}
      </Text>
      {aiDraft ? (
        <>
          <Text style={styles.draftLabel}>AI Draft</Text>
          <Text style={styles.draft}>{aiDraft}</Text>
        </>
      ) : (
        <Text style={styles.noDraft}>Urgent escalation — no AI draft shown.</Text>
      )}

      <View style={styles.actions}>
        {aiDraft ? (
          <Button onPress={onSendDraft} variant="ghost">
            Send Draft
          </Button>
        ) : null}
        <Button onPress={onEditSend} variant="ghost">
          Edit & Send
        </Button>
        <Button onPress={onEscalate} variant="primary">
          Escalate
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.darkCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.goldDim,
    padding: 14,
    gap: 8,
  },
  urgentCard: {
    borderColor: colors.danger,
  },
  patient: {
    ...typography.body,
    color: colors.white,
    fontSize: 16,
  },
  question: {
    ...typography.body,
    color: colors.gray1,
  },
  meta: {
    ...typography.body,
    color: colors.gray2,
    fontSize: 12,
  },
  badge: {
    ...typography.body,
    fontSize: 12,
    color: '#FFD9D9',
    backgroundColor: 'rgba(208,2,27,0.22)',
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  draftLabel: {
    ...typography.label,
    color: colors.gold,
    fontSize: 9,
  },
  draft: {
    ...typography.body,
    color: colors.white,
  },
  noDraft: {
    ...typography.body,
    color: colors.warning,
  },
  actions: {
    marginTop: 6,
    gap: 8,
  },
});
