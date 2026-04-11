import { useCallback, useMemo, useState } from 'react';

import type { OnboardingConversationAnswers } from '@/types/onboarding';

export type ChatMessage = { id: string; role: 'assistant' | 'user'; text: string };

type Phase =
  | { kind: 'turn'; n: 1 | 2 | 3 | 4 | 5 | 6 }
  | { kind: 'glp1_detail' }
  | { kind: 'commitment_echo' }
  | { kind: 'done' };

const COPY = {
  t1: `I want to be the best coach you've ever had. To do that, I need to know you first.\n\nWhat's the one thing you've tried before that never quite stuck?`,
  t2: `That makes a lot of sense. A lot of people have been there.\n\nWhat would feel different this time — what does success actually look like for you?`,
  t3: `Got it. I'm going to hold you to that.\n\nOn a scale of 1 to 10, how ready do you feel to actually do this right now?`,
  t4: `One more thing before we get you set up.\n\nAre you currently taking a GLP-1 medication like Ozempic, Wegovy, Mounjaro, or Zepbound?`,
  t4b: `Which medication are you on, and what dose are you currently taking? A few words each is fine.`,
  t5: `Are you working with a provider at Sona, or are you getting started on your own today?`,
  t6: `You're almost set up. Last thing —\n\nThe path to where you want to be isn't some mystery out there.\nIt's the next best step, right here, one day at a time. That's enough.\nChecking in every day — even just for a minute — is what moves the number.\n\nCan I count on you to show up?`,
  remind: `Because you're here. That's already the first step. Most people never take it. Let's go.`,
} as const;

function nid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useOnboardingChat() {
  const [phase, setPhase] = useState<Phase>({ kind: 'turn', n: 1 });
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: nid(), role: 'assistant', text: COPY.t1 },
  ]);
  const [answers, setAnswers] = useState<Partial<OnboardingConversationAnswers>>({});

  const appendAssistant = useCallback((text: string) => {
    setMessages((m) => [...m, { id: nid(), role: 'assistant', text }]);
  }, []);

  const appendUser = useCallback((text: string) => {
    setMessages((m) => [...m, { id: nid(), role: 'user', text }]);
  }, []);

  const advanceFromTurn1 = useCallback(
    (label: string) => {
      appendUser(label);
      setAnswers((a) => ({ ...a, past_struggle: label }));
      appendAssistant(COPY.t2);
      setPhase({ kind: 'turn', n: 2 });
    },
    [appendUser, appendAssistant],
  );

  const advanceFromTurn2 = useCallback(
    (label: string) => {
      appendUser(label);
      setAnswers((a) => ({ ...a, success_definition: label }));
      appendAssistant(COPY.t3);
      setPhase({ kind: 'turn', n: 3 });
    },
    [appendUser, appendAssistant],
  );

  const advanceFromTurn3 = useCallback(
    (label: string, score: number) => {
      appendUser(label);
      setAnswers((a) => ({ ...a, readiness_score: score }));
      appendAssistant(COPY.t4);
      setPhase({ kind: 'turn', n: 4 });
    },
    [appendUser, appendAssistant],
  );

  const advanceFromTurn4 = useCallback(
    (label: string, isGlp1: boolean | null) => {
      appendUser(label);
      setAnswers((a) => ({ ...a, is_glp1_patient: isGlp1 }));
      if (isGlp1 === true) {
        appendAssistant(COPY.t4b);
        setPhase({ kind: 'glp1_detail' });
      } else {
        appendAssistant(COPY.t5);
        setPhase({ kind: 'turn', n: 5 });
      }
    },
    [appendUser, appendAssistant],
  );

  const submitGlp1Detail = useCallback(
    (medication: string, dose: string) => {
      const med = medication.trim();
      const d = dose.trim();
      const line = [med, d].filter(Boolean).join(' · ') || '—';
      appendUser(line);
      setAnswers((a) => ({
        ...a,
        glp1_medication: med || null,
        glp1_dose: d || null,
      }));
      appendAssistant(COPY.t5);
      setPhase({ kind: 'turn', n: 5 });
    },
    [appendUser, appendAssistant],
  );

  const advanceFromTurn5 = useCallback(
    (label: string, connection: OnboardingConversationAnswers['clinic_connection']) => {
      appendUser(label);
      setAnswers((a) => ({ ...a, clinic_connection: connection }));
      appendAssistant(COPY.t6);
      setPhase({ kind: 'turn', n: 6 });
    },
    [appendUser, appendAssistant],
  );

  const advanceFromTurn6 = useCallback(
    (label: string) => {
      appendUser(label);
      setAnswers((a) => ({ ...a, commitment_response: label }));
      if (label.includes('Remind me')) {
        appendAssistant(COPY.remind);
        setPhase({ kind: 'commitment_echo' });
      } else {
        setPhase({ kind: 'done' });
      }
    },
    [appendUser, appendAssistant],
  );

  const finishCommitmentEcho = useCallback(
    (label: string) => {
      appendUser(label);
      setPhase({ kind: 'done' });
    },
    [appendUser],
  );

  const submitFreeText = useCallback(
    (raw: string) => {
      const t = raw.trim();
      if (!t || phase.kind !== 'turn') return;
      if (phase.n === 1) advanceFromTurn1(t);
      else if (phase.n === 2) advanceFromTurn2(t);
      else if (phase.n === 6) advanceFromTurn6(t);
    },
    [phase, advanceFromTurn1, advanceFromTurn2, advanceFromTurn6],
  );

  const progress = useMemo(() => {
    const userTurns = messages.filter((m) => m.role === 'user').length;
    const turnFraction =
      phase.kind === 'done' ? 1 : Math.min(1, (userTurns + (phase.kind === 'glp1_detail' ? 0.45 : 0)) / 6);
    return { step: 2, totalSteps: 7, turnFraction };
  }, [phase, messages]);

  const chips = useMemo(() => {
    if (phase.kind === 'done') return [];
    if (phase.kind === 'turn' && phase.n === 1) {
      return [
        { label: 'Meal prepping', onPress: () => advanceFromTurn1('Meal prepping') },
        { label: 'Consistent exercise', onPress: () => advanceFromTurn1('Consistent exercise') },
        { label: 'Calorie counting', onPress: () => advanceFromTurn1('Calorie counting') },
        { label: 'Staying motivated', onPress: () => advanceFromTurn1('Staying motivated') },
        { label: 'Other', onPress: () => advanceFromTurn1('Other') },
      ];
    }
    if (phase.kind === 'turn' && phase.n === 2) {
      return [
        { label: 'A number on the scale', onPress: () => advanceFromTurn2('A number on the scale') },
        { label: 'How my clothes fit', onPress: () => advanceFromTurn2('How my clothes fit') },
        { label: 'More energy', onPress: () => advanceFromTurn2('More energy') },
        { label: 'Feeling confident', onPress: () => advanceFromTurn2('Feeling confident') },
        { label: 'Keeping muscle', onPress: () => advanceFromTurn2('Keeping muscle') },
        { label: 'Other', onPress: () => advanceFromTurn2('Other') },
      ];
    }
    if (phase.kind === 'turn' && phase.n === 3) {
      return [
        { label: "10 — I'm all in", onPress: () => advanceFromTurn3("10 — I'm all in", 10) },
        { label: '7-8 — Pretty ready', onPress: () => advanceFromTurn3('7-8 — Pretty ready', 8) },
        { label: '5-6 — Somewhat ready', onPress: () => advanceFromTurn3('5-6 — Somewhat ready', 6) },
        {
          label: 'Below 5 — Honestly not sure',
          onPress: () => advanceFromTurn3('Below 5 — Honestly not sure', 4),
        },
      ];
    }
    if (phase.kind === 'turn' && phase.n === 4) {
      return [
        { label: 'Yes', onPress: () => advanceFromTurn4('Yes', true) },
        { label: 'No', onPress: () => advanceFromTurn4('No', false) },
        {
          label: 'Not sure what that is',
          onPress: () => advanceFromTurn4('Not sure what that is', false),
        },
      ];
    }
    if (phase.kind === 'turn' && phase.n === 5) {
      return [
        {
          label: "I'm a Sona patient",
          onPress: () => advanceFromTurn5("I'm a Sona patient", 'clinic_patient'),
        },
        {
          label: 'Just getting started on my own',
          onPress: () => advanceFromTurn5('Just getting started on my own', 'consumer'),
        },
        { label: 'Not sure yet', onPress: () => advanceFromTurn5('Not sure yet', 'unsure') },
      ];
    }
    if (phase.kind === 'turn' && phase.n === 6) {
      return [
        { label: "Yes, I'm in", onPress: () => advanceFromTurn6("Yes, I'm in") },
        { label: "I'll do my best", onPress: () => advanceFromTurn6("I'll do my best") },
        {
          label: 'Remind me why it matters',
          onPress: () => advanceFromTurn6('Remind me why it matters'),
        },
      ];
    }
    if (phase.kind === 'commitment_echo') {
      return [
        { label: "Let's go", onPress: () => finishCommitmentEcho("Let's go") },
        { label: "I'm ready", onPress: () => finishCommitmentEcho("I'm ready") },
      ];
    }
    return [];
  }, [
    phase,
    advanceFromTurn1,
    advanceFromTurn2,
    advanceFromTurn3,
    advanceFromTurn4,
    advanceFromTurn5,
    advanceFromTurn6,
    finishCommitmentEcho,
  ]);

  const showTextComposer =
    phase.kind !== 'done' &&
    phase.kind !== 'glp1_detail' &&
    phase.kind !== 'commitment_echo' &&
    phase.kind === 'turn' &&
    (phase.n === 1 || phase.n === 2 || phase.n === 6);

  const showGlp1Form = phase.kind === 'glp1_detail';

  const completionAnswers = useMemo((): OnboardingConversationAnswers | null => {
    if (phase.kind !== 'done') return null;
    const a = answers;
    if (
      a.past_struggle &&
      a.success_definition &&
      a.readiness_score != null &&
      a.is_glp1_patient != null &&
      a.clinic_connection &&
      a.commitment_response
    ) {
      return {
        past_struggle: a.past_struggle,
        success_definition: a.success_definition,
        readiness_score: a.readiness_score,
        is_glp1_patient: a.is_glp1_patient,
        glp1_medication: a.glp1_medication ?? null,
        glp1_dose: a.glp1_dose ?? null,
        clinic_connection: a.clinic_connection,
        commitment_response: a.commitment_response,
      };
    }
    return null;
  }, [phase.kind, answers]);

  return {
    messages,
    phase,
    progress,
    chips,
    showTextComposer,
    showGlp1Form,
    submitGlp1Detail,
    submitFreeText,
    completionAnswers,
  };
}
