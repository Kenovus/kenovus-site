import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { logAIAudit } from '@/lib/aiAudit';
import { EMERGENCY_KEYWORDS } from '@/constants/emergency';
import { countUserCoachMessagesToday } from '@/lib/aiUsage';
import { getDailyAiUserMessageCap } from '@/lib/consumerTier';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { anthropicMessages, anthropicMessagesStream } from '@/lib/anthropic';
import {
  fetchPatientClinicalContext,
  runPatientCoachClinicalQuery,
} from '@/lib/clinicalInsights';
import { supabase } from '@/lib/supabase';
import { maybeFlagGlp1DoseReviewForSimi } from '@/lib/glp1CoachReviewFlags';
import { upsertFoodLogEntry } from '@/lib/nutritionLogData';
import { parseConversationalFoodText, parseNaturalLanguageMeal } from '@/lib/nutritionFoodApi';
import { localDateKey } from '@/lib/patientSupplements';
import { upsertRecoveryLog } from '@/lib/recoveryLogs';
import { triggerClassifier } from '@/lib/triggerClassifier';
import { insertWeightLog } from '@/lib/weightLogs';
import { useAuth } from '@/hooks/useAuth';
import { buildSonaContext, buildMorningBrief } from '@/lib/patientContext';
import { detectMealCopyIntent, executeMealCopyIntent } from '@/lib/mealCopyIntent';
import { pickMoodResponse } from '@/lib/moodResponses';
import { formatWorkoutConfirmation, parseWorkoutFromText, saveParsedWorkout } from '@/lib/workoutNlp';

export type CoachMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
};

// ── Sona system prompt ────────────────────────────────────────────────────────
const SONA_SYSTEM_PROMPT = `You are Sona — an elite AI health, nutrition, fitness, and wellness coach.

You operate under the clinical guidance of Lance Kennedy DNP CRNA
and Simi Kennedy MSN, owner of Sona Medical Aesthetics.

Your job is not just to give information — your job is to drive
RESULTS through clarity, precision, and behavior change.

====================
CORE IDENTITY
====================

You are:
- A top 1% nutrition coach
- A top 1% strength and physique coach
- A clinical wellness advisor
- A behavior and accountability coach

You combine evidence-based science, real-world coaching experience,
clear confident communication, and identity-driven behavior change.

You are never robotic, vague, or overly academic.

====================
COACHING MODES — AUTO DETECT
====================

Automatically adjust based on the user's goal and context:

COMPETITOR MODE (body composition, stage prep, athletic performance)
- Direct, precise, data-driven
- Focus on performance, macros, progressive overload
- Minimal fluff, maximum output

GLP-1 MODE (on semaglutide, tirzepatide, or similar)
- Muscle preservation is non-negotiable
- High protein always priority one
- Manage appetite, energy, and recovery
- Encourage without being soft
- NEVER suggest dose changes — always defer to their provider

GENERAL WELLNESS MODE (longevity, energy, aesthetics, healthy aging)
- Simple, clear, encouraging
- Focus on sustainability and confidence
- Celebrate small wins
- Warm and accessible tone

====================
NUTRITION LOGIC
====================

Always apply:
- Protein is the anchor — non-negotiable
- Calories determine fat loss or gain
- Adjust based on weekly trends, not daily fluctuations
- Simplicity beats complexity

When advising:
- Give specific actionable options
- Prefer food swaps over restriction
- Offer fast solutions ("quick 40g protein options")
- Reference what the user has already logged today when relevant

====================
TRAINING LOGIC
====================

Always apply:
- Progressive overload is required for results
- Volume must match recovery capacity
- Technique and consistency matter more than novelty

When advising:
- Keep programs simple and executable
- Offer alternatives when time or energy is low
- Provide minimum effective dose options
- Reference the user's current training split when relevant

====================
SUPPLEMENT LOGIC
====================

- Evidence-based recommendations only
- Avoid hype or unnecessary stacks
- Prioritize fundamentals first (protein, creatine, vitamin D, omega-3)
- Never recommend anything contraindicated with GLP-1 medications
- Creatine: never exceed 5g/day recommendation

====================
BEHAVIOR AND IDENTITY COACHING
====================

You help the user become the type of person who succeeds.

Core principles to weave in naturally:
- "Discipline is trading what you want now for what you want most"
- "We don't negotiate with goals"
- "This is what consistency looks like"
- "You're becoming someone who shows up"
- "Adherence beats perfection every time"

Do NOT be preachy or cliché.
Integrate this naturally — only when earned by context.

====================
CLINICAL GUARDRAILS — NON NEGOTIABLE
====================

- NEVER suggest GLP-1 dose changes — always defer to provider
- NEVER recommend prescription medications
- NEVER diagnose medical conditions
- For anything beyond coaching scope say:
  "That's a great question for your next appointment with Simi"
- Supplement doses must stay within evidence-based ranges
- Always recommend provider consultation for medical decisions
- When uncertain — say so clearly and defer to provider
- If user mentions concerning symptoms — recommend they contact
  their provider immediately

====================
RESPONSE STYLE
====================

CRITICAL: Keep all responses under 150 words. Be direct and punchy. No essays.

- Clear and concise — never long essays
- Structured when helpful, conversational when not
- Always actionable
- Confident but never arrogant

Instead of: "Try to eat more protein"
Say: "You're 60g short. Easiest fix: shake + Greek yogurt. Want options?"

Instead of: "You should work out today"
Say: "No full session? Do 20 minutes. We don't miss twice."

Instead of: "That's great progress"
Say: "Protein hit 4 days straight. That's not motivation anymore — that's identity. Stack another day."

====================
PROACTIVE COACHING TRIGGERS
====================

When you have user context, proactively guide:
- Protein low → suggest fastest way to close the gap
- Calories off → suggest specific adjustment
- Workout missed → suggest shorter version, never skip twice
- Consistency streak → reinforce identity, not just praise
- GLP-1 user not eating enough → muscle preservation warning
- Upcoming aesthetic treatment → relevant pre/post care reminder

====================
SCOPE
====================

You are a coaching and wellness AI. You are not a medical provider.
Lance Kennedy DNP CRNA and Simi Kennedy MSN provide clinical oversight.
Route all medical questions to them appropriately.`;

function mid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function detectMealType(text: string): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const lower = text.toLowerCase();
  if (lower.includes('breakfast')) return 'breakfast';
  if (lower.includes('lunch')) return 'lunch';
  if (lower.includes('dinner')) return 'dinner';
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 22) return 'dinner';
  return 'snack';
}

function extractWeightMention(text: string): { value: number; unit: 'lb' | 'kg' } | null {
  const m = text.match(/(\d{2,3}(?:\.\d+)?)\s*(lb|lbs|pounds|kg|kgs|kilograms)\b/i);
  if (!m) return null;
  const value = Number(m[1]);
  if (!Number.isFinite(value)) return null;
  const rawUnit = m[2].toLowerCase();
  const unit = rawUnit.startsWith('k') ? 'kg' : 'lb';
  return { value, unit };
}

function extractRecoverySignals(text: string): { sleepHours: number | null; energy: number | null; stress: number | null } | null {
  const lower = text.toLowerCase();
  const mentionsRecovery =
    lower.includes('sleep') || lower.includes('slept') || lower.includes('energy') || lower.includes('stress') || lower.includes('mood');
  if (!mentionsRecovery) return null;
  const sleepMatch = lower.match(/(\d(?:\.\d+)?)\s*(hours|hrs|hr)\s*(of\s*)?sleep/);
  const sleepHours = sleepMatch ? Number(sleepMatch[1]) : null;
  const lowEnergy = /\b(low|drained|exhausted|tired)\b/.test(lower);
  const highEnergy = /\b(great|high|energized)\b/.test(lower);
  const highStress = /\b(high stress|stressed|anxious|overwhelmed)\b/.test(lower);
  return {
    sleepHours: Number.isFinite(sleepHours ?? NaN) ? sleepHours : null,
    energy: lowEnergy ? 3 : highEnergy ? 8 : null,
    stress: highStress ? 8 : null,
  };
}

function isJustAskIntent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.length > 120) return false;
  if (!t.endsWith('?')) return false;
  if (/\b(i|my|me|mine)\b/i.test(t)) return false;
  return /^(what|why|how|when|where|is|are|can|does|do)\b/i.test(t);
}

function isClinicalQuestion(text: string): boolean {
  const t = text.toLowerCase();
  return /\b(clinical|research|evidence|study|studies|pubmed|contraindication|side effect|safety|guideline|guidelines)\b/.test(t);
}

function detectMoodFromText(text: string): 'great' | 'good' | 'okay' | 'tired' | 'anxious' | null {
  const t = text.toLowerCase();
  if (/\b(anxious|anxiety|overwhelmed|panicky|panic|nervous)\b/.test(t)) return 'anxious';
  if (/\b(tired|exhausted|drained|fatigued|wiped)\b/.test(t)) return 'tired';
  if (/\b(great|amazing|awesome|fantastic|excellent)\b/.test(t)) return 'great';
  if (/\b(good|pretty good|doing good|doing well)\b/.test(t)) return 'good';
  if (/\b(ok|okay|fine|so-so|so so|alright)\b/.test(t)) return 'okay';
  return null;
}

function isSimpleGreetingOrAck(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (!t) return false;
  return /^(hi|hey|hello|yo|thanks|thank you|thx|ok|okay|k|sounds good|got it|perfect|cool|nice|great)\b[!.?]*$/.test(t);
}

function pickInstantGreetingAckResponse(): string {
  const options = [
    "I'm here with you. What's the one thing you want to focus on right now?",
    'Great, let us keep momentum. What are we tackling next?',
    'You got it. Tell me what you want to log or improve right now.',
    'Perfect. We can keep this simple, one step at a time.',
    'Love it. Want to log food, training, or a quick check-in?',
  ];
  return options[Math.floor(Math.random() * options.length)] ?? options[0];
}


export function useAI() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<CoachMessage[]>([
    {
      id: mid(),
      role: 'assistant',
      text: 'I looked at your recent pattern and you are close to a strong week. What feels hardest today?',
    },
  ]);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [emergencyVisible, setEmergencyVisible] = useState(false);
  const [emergencyAuditCtx, setEmergencyAuditCtx] = useState<{
    patientId: string | null;
    clinicId: string | null;
    sessionId: string | null;
    triggerCategory: string | null;
  } | null>(null);
  const [coachDailyUsage, setCoachDailyUsage] = useState<{ used: number; cap: number } | null>(null);

  const refreshCoachDailyUsage = useCallback(async () => {
    if (!user || !profile || profile.role !== 'consumer') {
      setCoachDailyUsage(null);
      return;
    }
    const patientId = await fetchPatientIdForAuthUser(user.id);
    if (!patientId) {
      setCoachDailyUsage(null);
      return;
    }
    const cap = getDailyAiUserMessageCap(profile);
    if (!Number.isFinite(cap)) {
      setCoachDailyUsage(null);
      return;
    }
    const used = await countUserCoachMessagesToday(patientId);
    setCoachDailyUsage({ used, cap });
  }, [user, profile]);

  useEffect(() => {
    void refreshCoachDailyUsage();
  }, [refreshCoachDailyUsage, messages.length]);

  useEffect(() => {
    if (!user) return;
    const now = new Date();
    if (now.getHours() < 18) return;
    void (async () => {
      const patientId = await fetchPatientIdForAuthUser(user.id);
      if (!patientId) return;
      const today = new Date().toISOString().slice(0, 10);
      const { count } = await supabase
        .from('training_logs')
        .select('id', { count: 'exact', head: true })
        .eq('patient_id', patientId)
        .eq('workout_date', today);
      if ((count ?? 0) === 0) {
        setMessages((m) => {
          if (m.some((x) => x.role === 'assistant' && x.text.includes('workout today'))) return m;
          return [
            ...m,
            {
              id: mid(),
              role: 'assistant',
              text: "Haven't logged a workout yet today. Tell me what you did and I can log it for you.",
            },
          ];
        });
      }
    })();
  }, [user]);

  const ensureConversation = useCallback(async () => {
    if (conversationId) return conversationId;
    if (!user) return null;
    const patientId = await fetchPatientIdForAuthUser(user.id);
    if (!patientId) return null;

    const { data: existing } = await supabase
      .from('ai_conversations')
      .select('id')
      .eq('patient_id', patientId)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      setConversationId(existing.id);
      return existing.id;
    }

    const { data: created } = await supabase
      .from('ai_conversations')
      .insert({
        patient_id: patientId,
        clinic_id: profile?.clinic_id ?? null,
        title: 'Sona',
      })
      .select('id')
      .maybeSingle();
    if (created?.id) {
      setConversationId(created.id);
      return created.id;
    }
    return null;
  }, [conversationId, user, profile?.clinic_id]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (!user) return;
      const cid = await ensureConversation();
      if (!cid || !mounted) return;

      // Check morning brief first so we can compose the final message list in one set
      let morningBriefMsg: CoachMessage | null = null;
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 11) {
        const todayKey = localDateKey(new Date());
        const briefStorageKey = `sona.morning.${todayKey}.${user.id}`;
        const alreadyShown = await AsyncStorage.getItem(briefStorageKey);
        if (!alreadyShown) {
          const briefText = await buildMorningBrief(user.id);
          if (briefText && mounted) {
            morningBriefMsg = { id: mid(), role: 'assistant', text: briefText };
            await AsyncStorage.setItem(briefStorageKey, '1');
          }
        }
      }

      if (!mounted) return;

      const { data } = await supabase
        .from('ai_messages')
        .select('id, role, content')
        .eq('conversation_id', cid)
        .order('created_at', { ascending: true })
        .limit(30);

      if (!mounted) return;

      const restored: CoachMessage[] = (data ?? [])
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ id: String(m.id), role: m.role as 'user' | 'assistant', text: m.content }));

      // Compose final message list: morning brief (if any) + history
      const finalMessages: CoachMessage[] = [];
      if (morningBriefMsg) finalMessages.push(morningBriefMsg);
      if (restored.length > 0) finalMessages.push(...restored);

      if (finalMessages.length > 0) setMessages(finalMessages);
    })();
    return () => {
      mounted = false;
    };
  }, [ensureConversation, user]);

  const send = useCallback(async (input: string) => {
    const text = input.trim();
    if (!text) return;

    setLoading(true);
    try {
      const now = new Date();
      // Only intercept messages that are explicitly asking about the date/time — not sentences that happen to contain "today"
      const isDateTimeQuery =
        /^(what('s| is)?\s+(today'?s?\s+)?(date|day|time)|current\s+(date|time)|what\s+day\s+is\s+it|what\s+time\s+is\s+it)\b/i.test(text.trim()) ||
        (text.trim().length < 25 && /^(today|date|time|what day|what time)\??[.!]?$/i.test(text.trim()));
      if (isDateTimeQuery) {
        const dateReply = `Today is ${now.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}. The time is ${now.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })}.`;
        setMessages((m) => [...m, { id: mid(), role: 'user', text }, { id: mid(), role: 'assistant', text: dateReply }]);
        setLoading(false);
        return;
      }

      const patientId = user
        ? await Promise.race([
            fetchPatientIdForAuthUser(user.id),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
          ])
        : null;
      const cap = getDailyAiUserMessageCap(profile);
      if (patientId && Number.isFinite(cap)) {
        const used = await countUserCoachMessagesToday(patientId);
        if (used >= cap) {
          Alert.alert(
            'Daily Sona limit reached',
            `Free and Core plans include a daily message cap (${cap} per day). Upgrade to GLP-1+ for unlimited Sona messages, or try again tomorrow.`,
            [
              { text: 'OK', style: 'cancel' },
              { text: 'View plans', onPress: () => router.push('/patient/profile/consumer_plan') },
            ],
          );
          setLoading(false);
          return;
        }
      }

      setMessages((m) => [...m, { id: mid(), role: 'user', text }]);
      const cid = await ensureConversation();
      if (cid) {
        await supabase.from('ai_messages').insert({
          conversation_id: cid,
          role: 'user',
          content: text,
        });
      }
      await logAIAudit({
        patientId,
        clinicId: profile?.clinic_id ?? null,
        sessionId: cid,
        role: 'user',
        content: text,
      });
      const mood = detectMoodFromText(text);
      if (mood) {
        const moodReply = pickMoodResponse(mood);
        setMessages((m) => [...m, { id: mid(), role: 'assistant', text: moodReply }]);
        if (cid) {
          await supabase.from('ai_messages').insert({
            conversation_id: cid,
            role: 'assistant',
            content: moodReply,
          });
        }
        await refreshCoachDailyUsage();
        return;
      }
      if (isSimpleGreetingOrAck(text)) {
        const instantReply = pickInstantGreetingAckResponse();
        setMessages((m) => [...m, { id: mid(), role: 'assistant', text: instantReply }]);
        if (cid) {
          await supabase.from('ai_messages').insert({
            conversation_id: cid,
            role: 'assistant',
            content: instantReply,
          });
        }
        await refreshCoachDailyUsage();
        return;
      }
      const parsedWorkout = parseWorkoutFromText(text);
      if (patientId && parsedWorkout.sets.length > 0) {
        const incomplete = parsedWorkout.sets.find((x) => x.reps == null || x.weight == null);
        const saveRes = await saveParsedWorkout({
          patientId,
          parsed: parsedWorkout.sets,
          notes: parsedWorkout.notes,
        });
        const confirm = formatWorkoutConfirmation(parsedWorkout.sets);
        const workoutReply = saveRes.error
          ? `I parsed your workout but couldn't save it: ${saveRes.error}. Retry?`
          : incomplete
            ? `Logged: ${confirm}. How many reps on ${incomplete.exercise}?`
            : `Logged: ${confirm}. Saved. Stack another day.`;
        setMessages((m) => [...m, { id: mid(), role: 'assistant', text: workoutReply }]);
        if (cid) {
          await supabase.from('ai_messages').insert({
            conversation_id: cid,
            role: 'assistant',
            content: workoutReply,
          });
          await supabase
            .from('ai_conversations')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', cid);
        }
        await refreshCoachDailyUsage();
        return;
      }

      if (patientId) {
        const weightMention = extractWeightMention(text);
        if (weightMention) {
          const weightSave = await insertWeightLog({
            patientId,
            weightValue: weightMention.value,
            unit: weightMention.unit,
            logDate: localDateKey(new Date()),
          });
          const weightReply = weightSave.error
            ? `I caught your weight entry but couldn't save it just now: ${weightSave.error}`
            : `Logged: ${weightMention.value}${weightMention.unit} to your weight log.`;
          setMessages((m) => [...m, { id: mid(), role: 'assistant', text: weightReply }]);
          if (cid) {
            await supabase.from('ai_messages').insert({
              conversation_id: cid,
              role: 'assistant',
              content: weightReply,
            });
          }
          await refreshCoachDailyUsage();
          return;
        }

        // ── Meal copy / repeat intent (fast Supabase path, no Claude needed) ──
        const mealCopyIntent = detectMealCopyIntent(text);
        if (mealCopyIntent && user?.id) {
          const copyReply = await executeMealCopyIntent({ intent: mealCopyIntent, patientId, userId: user.id });
          if (copyReply) {
            setMessages((m) => [...m, { id: mid(), role: 'assistant', text: copyReply }]);
            if (cid) await supabase.from('ai_messages').insert({ conversation_id: cid, role: 'assistant', content: copyReply });
            await refreshCoachDailyUsage();
            return;
          }
        }

        const lower = text.toLowerCase();
        if (/\b(i had|i ate|ate|for breakfast|for lunch|for dinner|meal|snack|log|logged|logging|just had|just ate|had a|eating)\b/.test(lower)) {
          console.log('[FOOD] attempting to parse:', text);
          const foods = await parseConversationalFoodText(text);
          console.log('[FOOD] parsed foods:', JSON.stringify(foods));
          if (foods.length > 0) {
            const mealType = detectMealType(text);
            const foodLogDate = localDateKey(new Date());
            for (const f of foods) {
              console.log('[FOOD] logging for date:', foodLogDate);
              await upsertFoodLogEntry({
                patient_id: patientId,
                log_date: foodLogDate,
                meal_type: mealType,
                food_name: f.name,
                brand: f.brand,
                calories: f.calories,
                protein_g: f.protein_g,
                carbs_g: f.carbs_g,
                fat_g: f.fat_g,
                serving_size: f.serving_size,
                serving_unit: f.serving_unit,
                source: 'coach_nlp',
              });
              console.log('[FOOD] logged food entry:', f.name, f.calories, f.protein_g);
            }
            const caloriesTotal = foods.reduce((sum, f) => sum + Number(f.calories ?? 0), 0);
            const proteinTotal = foods.reduce((sum, f) => sum + Number(f.protein_g ?? 0), 0);
            console.log('[FOOD] totals cal:', caloriesTotal, 'protein:', proteinTotal);
            const foodReply = `Got it — logged ${foods.map((f) => f.name).join(' and ')} to your ${mealType}. That's about ${Math.round(caloriesTotal)} calories and ${Math.round(proteinTotal)}g protein.`;
            setMessages((m) => [...m, { id: mid(), role: 'assistant', text: foodReply }]);
            if (cid) {
              await supabase.from('ai_messages').insert({
                conversation_id: cid,
                role: 'assistant',
                content: foodReply,
              });
            }
            await refreshCoachDailyUsage();
            return;
          }
          console.log('[FOOD] attempting to parse:', text);
          const fallbackFoods = await parseNaturalLanguageMeal(text);
          console.log('[FOOD] parsed foods:', JSON.stringify(fallbackFoods));
          if (fallbackFoods.length > 0) {
            const mealType = detectMealType(text);
            const foodLogDate = localDateKey(new Date());
            for (const f of fallbackFoods) {
              console.log('[FOOD] logging for date:', foodLogDate);
              await upsertFoodLogEntry({
                patient_id: patientId,
                log_date: foodLogDate,
                meal_type: mealType,
                food_name: f.name,
                brand: f.brand,
                calories: f.calories,
                protein_g: f.protein_g,
                carbs_g: f.carbs_g,
                fat_g: f.fat_g,
                serving_size: f.serving_size,
                serving_unit: f.serving_unit,
                source: 'coach_nlp',
              });
              console.log('[FOOD] logged food entry:', f.name, f.calories, f.protein_g);
            }
            const caloriesTotal = fallbackFoods.reduce((sum, f) => sum + Number(f.calories ?? 0), 0);
            const proteinTotal = fallbackFoods.reduce((sum, f) => sum + Number(f.protein_g ?? 0), 0);
            console.log('[FOOD] totals cal:', caloriesTotal, 'protein:', proteinTotal);
            const foodReply = `Got it — logged ${fallbackFoods.map((f) => f.name).join(' and ')} to your ${mealType}. That's about ${Math.round(caloriesTotal)} calories and ${Math.round(proteinTotal)}g protein.`;
            setMessages((m) => [...m, { id: mid(), role: 'assistant', text: foodReply }]);
            if (cid) {
              await supabase.from('ai_messages').insert({
                conversation_id: cid,
                role: 'assistant',
                content: foodReply,
              });
            }
            await refreshCoachDailyUsage();
            return;
          }
        }

        const recovery = extractRecoverySignals(text);
        if (recovery) {
          await upsertRecoveryLog({
            patientId,
            logDate: localDateKey(new Date()),
            sleep_hours: recovery.sleepHours,
            soreness_level: null,
            soreness_muscle_groups: [],
            energy_level: recovery.energy,
            stress_level: recovery.stress,
          });
        }
      }

      const classification = triggerClassifier(text);
      if (classification.triggered) {
        const hardStop = classification.response ?? 'Please contact your provider for this question.';
        const isEmergency =
          classification.category === 'severe_symptoms' ||
          classification.category === 'mental_health_crisis' ||
          EMERGENCY_KEYWORDS.some((kw) => text.toLowerCase().includes(kw));
        if (isEmergency) {
          setEmergencyVisible(true);
          setEmergencyAuditCtx({
            patientId,
            clinicId: profile?.clinic_id ?? null,
            sessionId: cid,
            triggerCategory: classification.category,
          });
        }
        setMessages((m) => [...m, { id: mid(), role: 'assistant', text: hardStop }]);
        if (cid) {
          await supabase.from('ai_messages').insert({
            conversation_id: cid,
            role: 'assistant',
            content: hardStop,
            flagged: true,
          });
          await supabase
            .from('ai_conversations')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', cid);
        }
        await logAIAudit({
          patientId,
          clinicId: profile?.clinic_id ?? null,
          sessionId: cid,
          role: 'assistant',
          content: hardStop,
          triggerDetected: true,
          triggerCategory: classification.category,
          flaggedForReview: true,
          flagReason: classification.category,
          emergencyOverlayShown: isEmergency,
        });
        await refreshCoachDailyUsage();
        return;
      }

      const justAsk = isJustAskIntent(text);
      if (justAsk) {
        const startedAt = Date.now();
        const { text: reply, error, model, inputTokens, outputTokens } = await anthropicMessages({
          system:
            'You are Sona. Answer concise factual health/wellness questions in 2-4 sentences. Do not reference personal patient data or history.',
          user: text,
          maxTokens: 180,
        });
        const finalReply =
          reply?.trim() ||
          'Here is a concise answer: this can vary by person, so use general guidance and confirm clinical specifics with your provider.';
        setMessages((m) => [...m, { id: mid(), role: 'assistant', text: finalReply }]);
        if (cid) {
          await supabase.from('ai_messages').insert({
            conversation_id: cid,
            role: 'assistant',
            content: finalReply,
          });
        }
        await logAIAudit({
          patientId,
          clinicId: profile?.clinic_id ?? null,
          sessionId: cid,
          role: 'assistant',
          content: finalReply,
          modelUsed: model,
          tokensInput: inputTokens,
          tokensOutput: outputTokens,
          responseTimeMs: Date.now() - startedAt,
          flaggedForReview: Boolean(error),
          flagReason: error ? error.message : null,
        });
        await refreshCoachDailyUsage();
        return;
      }

      if (isClinicalQuestion(text)) {
        const patientCtx = patientId ? await fetchPatientClinicalContext(patientId) : null;
        const { response: clinicalResponse } = await runPatientCoachClinicalQuery({
          providerId: user?.id ?? 'patient-coach',
          clinicId: profile?.clinic_id ?? null,
          queryText: text,
          specialties: ['General Internal Medicine'],
          patientContext: patientCtx,
        });
        const clinicalReply = `${clinicalResponse.clinical_answer}\n\nConfidence: ${clinicalResponse.confidence_level}.`;
        setMessages((m) => [...m, { id: mid(), role: 'assistant', text: clinicalReply }]);
        if (cid) {
          await supabase.from('ai_messages').insert({
            conversation_id: cid,
            role: 'assistant',
            content: clinicalReply,
          });
        }
        await refreshCoachDailyUsage();
        return;
      }

      const context = messagesRef.current
        .slice(-8)
        .map((m) => `${m.role}: ${m.text}`)
        .join('\n');

      // Build live patient context — 4s hard timeout so a slow Supabase query never stalls the reply
      const sonaCtx = await Promise.race([
        user?.id ? buildSonaContext(user.id) : Promise.resolve(''),
        new Promise<string>((res) => setTimeout(() => res(''), 4000)),
      ]);

      // Diagnostic: verify system prompt and context are present
      console.log('SYSTEM PROMPT LENGTH:', SONA_SYSTEM_PROMPT.length);
      console.log('CONTEXT:', sonaCtx.substring(0, 200));
      console.log('USER MESSAGE:', text);
      console.log(`Sona context built: ${sonaCtx.length} chars`);

      // Patient context prefixes the user message; system prompt stays clean and cacheable
      const augmentedUser = sonaCtx
        ? `${sonaCtx}\n\nConversation so far:\n${context}\n\nUser: ${text}`
        : `${context}\nuser: ${text}`;

      const startedAt = Date.now();
      // Stream response — first token arrives in ~1s, user sees words immediately
      const assistantId = mid();
      setMessages((m) => [...m, { id: assistantId, role: 'assistant', text: '' }]);

      let finalReply = '';
      let firstChunk = true;
      try {
        for await (const chunk of anthropicMessagesStream({
          system: SONA_SYSTEM_PROMPT,
          user: augmentedUser,
          maxTokens: 200,
        })) {
          if (firstChunk) {
            firstChunk = false;
            setLoading(false); // first word arrived — hide "thinking" spinner immediately
          }
          finalReply += chunk;
          setMessages((m) => m.map((msg) =>
            msg.id === assistantId ? { ...msg, text: finalReply } : msg,
          ));
        }
      } catch (streamErr) {
        console.warn('[Sona] Streaming error:', streamErr);
      }

      if (!finalReply) {
        finalReply = 'I can help with wellness planning, but I cannot reach the AI service right now. Try again in a moment.';
        setMessages((m) => m.map((msg) =>
          msg.id === assistantId ? { ...msg, text: finalReply } : msg,
        ));
      }

      const responseMs = Date.now() - startedAt;

      if (cid) {
        await supabase.from('ai_messages').insert({
          conversation_id: cid,
          role: 'assistant',
          content: finalReply,
        });
        await supabase
          .from('ai_conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', cid);
      }
      await logAIAudit({
        patientId,
        clinicId: profile?.clinic_id ?? null,
        sessionId: cid,
        role: 'assistant',
        content: finalReply,
        modelUsed: null,
        tokensInput: null,
        tokensOutput: null,
        responseTimeMs: responseMs,
        flaggedForReview: false,
        flagReason: null,
      });
      await maybeFlagGlp1DoseReviewForSimi({
        patientId,
        clinicId: profile?.clinic_id ?? null,
        profile,
        userMessage: text,
        sessionId: cid,
      });
      await refreshCoachDailyUsage();
    } finally {
      setLoading(false);
    }
  }, [ensureConversation, profile, user, refreshCoachDailyUsage]);

  return useMemo(
    () => ({
      messages,
      loading,
      send,
      coachDailyUsage,
      emergencyVisible,
      dismissEmergency: async () => {
        setEmergencyVisible(false);
        if (!emergencyAuditCtx) return;
        await logAIAudit({
          patientId: emergencyAuditCtx.patientId,
          clinicId: emergencyAuditCtx.clinicId,
          sessionId: emergencyAuditCtx.sessionId,
          role: 'assistant',
          content: '[emergency_overlay_action] dismissed',
          triggerDetected: true,
          triggerCategory: emergencyAuditCtx.triggerCategory,
          flaggedForReview: true,
          flagReason: 'Emergency overlay dismissed by user',
          emergencyOverlayShown: true,
          emergencyUserAction: 'dismissed',
        });
        setEmergencyAuditCtx(null);
      },
      callEmergency: async () => {
        setEmergencyVisible(false);
        if (!emergencyAuditCtx) return;
        await logAIAudit({
          patientId: emergencyAuditCtx.patientId,
          clinicId: emergencyAuditCtx.clinicId,
          sessionId: emergencyAuditCtx.sessionId,
          role: 'assistant',
          content: '[emergency_overlay_action] call_911',
          triggerDetected: true,
          triggerCategory: emergencyAuditCtx.triggerCategory,
          flaggedForReview: true,
          flagReason: 'Emergency overlay call 911 tapped',
          emergencyOverlayShown: true,
          emergencyUserAction: 'call_911',
        });
        setEmergencyAuditCtx(null);
      },
    }),
    [messages, loading, send, coachDailyUsage, emergencyVisible, emergencyAuditCtx],
  );
}
