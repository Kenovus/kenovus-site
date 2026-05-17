import { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import {
  fetchWeeklyCheckinForAnchor,
  getWeeklySupplementRetroAnchor,
  isWeeklySupplementCheckinWindow,
  saveWeeklySupplementCheckin,
} from '@/lib/patientSupplements';
import { fetchWeeklySupplementCoachReply } from '@/lib/supplementWeeklyCoachReply';
import { isSupplementWeeklySnoozed, snoozeSupplementWeeklyPrompt } from '@/lib/supplementWeeklyLocalDismiss';
import { WEEKLY_SUPPLEMENT_CHOICES, type WeeklySupplementConsistency } from '@/lib/supplements/curatedPresets';
import { useAuth } from '@/hooks/useAuth';

/**
 * End-of-week in-app check-in (Sat ≥18:00 or Sun ≥17:00 device local) for supplement consistency + short coach reply.
 */
export function WeeklySupplementCheckinGate() {
  const { user, profile } = useAuth();
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<'pick' | 'coach'>('pick');
  const [coachText, setCoachText] = useState('');
  const [busy, setBusy] = useState(false);

  const firstName = profile?.full_name?.split(/\s+/)[0] ?? 'there';

  const evaluate = useCallback(async () => {
    if (!user?.id) return;
    const d = new Date();
    if (!isWeeklySupplementCheckinWindow(d)) {
      setVisible(false);
      return;
    }
    const anchor = getWeeklySupplementRetroAnchor(d);
    const snoozed = await isSupplementWeeklySnoozed(anchor);
    if (snoozed) {
      setVisible(false);
      return;
    }
    const pid = await fetchPatientIdForAuthUser(user.id);
    if (!pid) {
      setVisible(false);
      return;
    }
    const existing = await fetchWeeklyCheckinForAnchor(pid, anchor);
    if (existing) {
      setVisible(false);
      return;
    }
    setPhase('pick');
    setCoachText('');
    setVisible(true);
  }, [user?.id]);

  useEffect(() => {
    void evaluate();
  }, [evaluate]);

  useEffect(() => {
    const onAppState = (s: AppStateStatus) => {
      if (s === 'active') void evaluate();
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [evaluate]);

  useEffect(() => {
    const id = setInterval(() => {
      const dow = new Date().getDay();
      if (dow === 0 || dow === 6) void evaluate();
    }, 60 * 1000);
    return () => clearInterval(id);
  }, [evaluate]);

  const onChoice = async (choice: WeeklySupplementConsistency) => {
    if (!user?.id || busy) return;
    setBusy(true);
    try {
      const pid = await fetchPatientIdForAuthUser(user.id);
      if (!pid) return;
      const anchor = getWeeklySupplementRetroAnchor();
      const reply = await fetchWeeklySupplementCoachReply({ firstName, choice });
      const { error } = await saveWeeklySupplementCheckin({
        patientId: pid,
        weekAnchor: anchor,
        consistency: choice,
        aiReply: reply,
      });
      if (error) {
        setCoachText('Thanks for checking in—your note did not save. Try again from Profile → Supplements.');
      } else {
        setCoachText(reply);
      }
      setPhase('coach');
    } finally {
      setBusy(false);
    }
  };

  const onDone = () => {
    setVisible(false);
  };

  const onSnooze = async () => {
    const anchor = getWeeklySupplementRetroAnchor();
    await snoozeSupplementWeeklyPrompt(anchor);
    setVisible(false);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {phase === 'pick' ? (
            <>
              <Text style={styles.title}>Supplements this week</Text>
              <Text style={styles.body}>
                Looking back at this past week, how consistent were you with your supplements?
              </Text>
              <View style={styles.choices}>
                {WEEKLY_SUPPLEMENT_CHOICES.map((c) => (
                  <Pressable
                    key={c.id}
                    disabled={busy}
                    onPress={() => void onChoice(c.id)}
                    style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}>
                    <Text style={styles.choiceText}>{c.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Button variant="ghost" disabled={busy} onPress={() => void onSnooze()}>
                Remind me later
              </Button>
            </>
          ) : (
            <>
              <Text style={styles.title}>My Coach</Text>
              <Text style={styles.coach}>{coachText}</Text>
              <Button variant="primary" onPress={onDone}>
                Continue
              </Button>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: colors.darkCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.goldDim,
    padding: 18,
    gap: 12,
  },
  title: {
    ...typography.h2,
    color: colors.white,
  },
  body: {
    ...typography.body,
    color: colors.gray1,
    lineHeight: 22,
  },
  choices: {
    gap: 10,
  },
  choice: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: colors.dark,
  },
  choicePressed: {
    borderColor: colors.gold,
  },
  choiceText: {
    ...typography.body,
    color: colors.white,
    textAlign: 'center',
  },
  coach: {
    ...typography.body,
    color: colors.white,
    fontSize: 17,
    lineHeight: 26,
  },
});
