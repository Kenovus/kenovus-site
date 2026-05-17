import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MessageTriageCard } from '@/components/provider/MessageTriageCard';
import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { triagePatientMessage } from '@/lib/triage';

type InboxItem = {
  id: string;
  patientId: string | null;
  patientName: string;
  question: string;
  createdAtIso: string;
  triageLayer: 1 | 2 | 3 | null;
  aiDraft: string | null;
  escalationReason: string | null;
  isUrgent: boolean;
  emergencyOverlayShown: boolean;
  emergencyUserAction: 'call_911' | 'dismissed' | null;
};

export default function ProviderMessages() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id ?? null;

  const [messages, setMessages] = useState<InboxItem[]>([]);
  const [composer, setComposer] = useState('');
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'urgent' | 'emergency_action'>('all');

  const fetchMessages = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('patient_messages')
        .select(
          'id, created_at, patient_id, message_text, triage_layer, ai_draft, escalation_reason, is_urgent',
        )
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) {
        Alert.alert('Inbox load failed', error.message);
        return;
      }
      const rows = data ?? [];
      const patientIds = [...new Set(rows.map((r) => r.patient_id).filter(Boolean))] as string[];
      let patientMap = new Map<string, string>();
      if (patientIds.length > 0) {
        const { data: patients } = await supabase
          .from('patients')
          .select('id, first_name, last_name')
          .in('id', patientIds);
        patientMap = new Map(
          (patients ?? []).map((p) => [p.id as string, `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()]),
        );
      }
      const emergencyMap = new Map<
        string,
        { shown: boolean; action: 'call_911' | 'dismissed' | null }
      >();
      if (patientIds.length > 0) {
        const { data: audits } = await supabase
          .from('ai_audit_log')
          .select('patient_id, emergency_overlay_shown, emergency_user_action, created_at')
          .in('patient_id', patientIds)
          .eq('emergency_overlay_shown', true)
          .order('created_at', { ascending: false });
        for (const a of audits ?? []) {
          const pid = a.patient_id as string | null;
          if (!pid || emergencyMap.has(pid)) continue;
          const action = (a.emergency_user_action as 'call_911' | 'dismissed' | null) ?? null;
          emergencyMap.set(pid, { shown: true, action });
        }
      }

      const mapped: InboxItem[] = rows.map((row) => ({
        id: row.id as string,
        patientId: (row.patient_id as string | null) ?? null,
        patientName: patientMap.get(row.patient_id as string) ?? 'Patient',
        question: (row.message_text as string) ?? '',
        createdAtIso: (row.created_at as string) ?? new Date().toISOString(),
        triageLayer: (row.triage_layer as 1 | 2 | 3 | null) ?? null,
        aiDraft: (row.ai_draft as string | null) ?? null,
        escalationReason: (row.escalation_reason as string | null) ?? null,
        isUrgent: row.is_urgent === true,
        emergencyOverlayShown: row.patient_id ? (emergencyMap.get(row.patient_id as string)?.shown ?? false) : false,
        emergencyUserAction: row.patient_id
          ? (emergencyMap.get(row.patient_id as string)?.action ?? null)
          : null,
      }));
      setMessages(mapped);

      const pending = mapped.filter((m) => m.triageLayer === null);
      for (const item of pending) {
        const triage = triagePatientMessage(item.question);
        await supabase.from('patient_messages').update({
          triage_layer: triage.layer,
          ai_draft: triage.aiDraft,
          escalation_reason: triage.escalationReason,
          is_urgent: triage.urgent,
        }).eq('id', item.id);

        const { data: existingLog } = await supabase
          .from('message_triage_log')
          .select('id')
          .eq('message_id', item.id)
          .maybeSingle();
        if (!existingLog) {
          await supabase.from('message_triage_log').insert({
            message_id: item.id,
            confidence_score: triage.confidenceScore,
            escalation_reason: triage.escalationReason,
            layer_assigned: triage.layer,
            keywords_matched: triage.keywords,
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!clinicId) return;
    const ch = supabase
      .channel(`provider-messages-${clinicId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'patient_messages', filter: `clinic_id=eq.${clinicId}` },
        () => {
          void fetchMessages();
        },
      )
      .subscribe();

    const id = setInterval(() => {
      void fetchMessages();
    }, 15000);

    return () => {
      clearInterval(id);
      void supabase.removeChannel(ch);
    };
  }, [clinicId, fetchMessages]);

  const triaged = useMemo(
    () =>
      messages.map((m) => {
        const fallback = triagePatientMessage(m.question);
        return {
          ...m,
          triage: {
            layer: m.triageLayer ?? fallback.layer,
            aiDraft: m.aiDraft ?? fallback.aiDraft,
            escalationReason: m.escalationReason ?? fallback.escalationReason,
            confidenceScore: fallback.confidenceScore,
          },
        };
      }),
    [messages],
  );
  const filtered = useMemo(() => {
    if (filter === 'all') return triaged;
    if (filter === 'urgent') return triaged.filter((m) => m.triage.layer === 3 || m.isUrgent);
    return triaged.filter((m) => m.emergencyOverlayShown || m.emergencyUserAction != null);
  }, [triaged, filter]);

  const urgentCount = triaged.filter((m) => m.triage.layer === 3).length;

  const postSimulatedIncoming = async () => {
    const q = composer.trim();
    if (!q || !clinicId) return;
    setPosting(true);
    try {
      const firstPatientId = messages.find((m) => m.patientId)?.patientId;
      if (!firstPatientId) {
        Alert.alert(
          'No patient found',
          'Create at least one patient in this clinic before posting test messages.',
        );
        return;
      }
      const { error } = await supabase.from('patient_messages').insert({
        patient_id: firstPatientId,
        clinic_id: clinicId,
        message_text: q,
        message_source: 'patient',
      });
      if (error) {
        Alert.alert('Insert failed', error.message);
        return;
      }
      setComposer('');
      await fetchMessages();
    } finally {
      setPosting(false);
    }
  };

  const markSent = async (messageId: string, draft: string, edited: boolean) => {
    const { error } = await supabase
      .from('patient_messages')
      .update({
        provider_sent_draft: !edited,
        provider_edited_draft: edited,
        final_response_text: draft,
        responded_at: new Date().toISOString(),
        responded_by: profile?.id ?? null,
      })
      .eq('id', messageId);
    if (error) {
      Alert.alert('Send failed', error.message);
      return;
    }
    Alert.alert('Sent', edited ? 'Edited response sent to patient.' : 'Draft sent to patient.');
    await fetchMessages();
  };

  const escalate = async (messageId: string) => {
    const { error } = await supabase
      .from('patient_messages')
      .update({
        triage_layer: 3,
        is_urgent: true,
        escalation_reason: 'Escalated by provider',
      })
      .eq('id', messageId);
    if (error) {
      Alert.alert('Escalation failed', error.message);
      return;
    }
    await supabase.from('message_triage_log').insert({
      message_id: messageId,
      confidence_score: 1,
      escalation_reason: 'Escalated by provider',
      layer_assigned: 3,
      keywords_matched: ['manual escalation'],
    });
    Alert.alert('Escalated', 'Message routed to urgent provider queue.');
    await fetchMessages();
  };

  if (!clinicId) {
    return (
      <View style={[styles.wrap, styles.center]}>
        <Text style={styles.title}>AI Triage Inbox</Text>
        <Text style={styles.subtitle}>No clinic is linked to this provider profile yet.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: 24 }]}>
      <Text style={styles.title}>AI Triage Inbox</Text>
      <Text style={styles.subtitle}>
        Live Supabase queue with realtime updates + polling fallback. Urgent right now: {urgentCount}
      </Text>
      <View style={styles.filterRow}>
        <Button
          variant={filter === 'all' ? 'primary' : 'ghost'}
          onPress={() => setFilter('all')}>
          All
        </Button>
        <Button
          variant={filter === 'urgent' ? 'primary' : 'ghost'}
          onPress={() => setFilter('urgent')}>
          Urgent
        </Button>
        <Button
          variant={filter === 'emergency_action' ? 'primary' : 'ghost'}
          onPress={() => setFilter('emergency_action')}>
          Emergency Actions
        </Button>
      </View>

      <View style={styles.composeCard}>
        <Text style={styles.composeLabel}>Post test patient message (writes to `patient_messages`)</Text>
        <TextInput
          value={composer}
          onChangeText={setComposer}
          placeholder="Type a patient message..."
          placeholderTextColor={colors.gray2}
          style={styles.input}
        />
        <Button onPress={() => void postSimulatedIncoming()} variant="ghost" loading={posting}>
          Insert test message
        </Button>
      </View>

      <View style={styles.list}>
        {loading && messages.length === 0 ? <Text style={styles.empty}>Loading inbox...</Text> : null}
        {!loading && filtered.length === 0 ? (
          <Text style={styles.empty}>No messages yet for this clinic.</Text>
        ) : null}
        {filtered.map((item) => (
          <MessageTriageCard
            key={item.id}
            patientName={`${item.patientName} · ${formatTimeAgo(item.createdAtIso)}`}
            question={item.question}
            aiDraft={item.triage.layer === 1 ? null : item.triage.aiDraft}
            confidenceScore={item.triage.confidenceScore}
            layer={item.triage.layer}
            escalationReason={item.triage.escalationReason}
            emergencyBadge={
              item.emergencyUserAction === 'call_911'
                ? 'Emergency Overlay: Called 911'
                : item.emergencyUserAction === 'dismissed'
                  ? 'Emergency Overlay: Dismissed'
                  : item.emergencyOverlayShown
                    ? 'Emergency Overlay Shown'
                    : null
            }
            onSendDraft={() =>
              void markSent(item.id, item.triage.aiDraft ?? 'Protocol response sent.', false)
            }
            onEditSend={() =>
              void markSent(
                item.id,
                `${item.triage.aiDraft ?? 'Response drafted.'}\n\nReviewed and edited by provider.`,
                true,
              )
            }
            onEscalate={() => void escalate(item.id)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function formatTimeAgo(iso: string): string {
  const ts = new Date(iso).getTime();
  const delta = Math.max(0, Date.now() - ts);
  const min = Math.floor(delta / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.dark },
  center: { justifyContent: 'center', paddingHorizontal: 20 },
  content: { paddingHorizontal: 20 },
  title: { ...typography.h1, color: colors.white, marginBottom: 8 },
  subtitle: { ...typography.body, color: colors.gray1, marginBottom: 14 },
  composeCard: {
    backgroundColor: colors.darkCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.goldDim,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  composeLabel: { ...typography.body, color: colors.goldLight },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  empty: { ...typography.body, color: colors.gray2, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 12,
    backgroundColor: colors.dark2,
    color: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...typography.body,
  },
  list: { gap: 10 },
});
