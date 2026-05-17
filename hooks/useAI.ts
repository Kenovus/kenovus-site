import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { logAIAudit } from '@/lib/aiAudit';
import { EMERGENCY_KEYWORDS } from '@/constants/emergency';
import { countUserCoachMessagesToday } from '@/lib/aiUsage';
import { getDailyAiUserMessageCap } from '@/lib/consumerTier';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { anthropicMessages } from '@/lib/anthropic';
import {
  fetchPatientClinicalContext,
  runPatientCoachClinicalQuery,
} from '@/lib/clinicalInsights';
import { supabase } from '@/lib/supabase';
import { buildFitnessCoachContextBlock } from '@/lib/fitnessCoachContext';
import { maybeFlagGlp1DoseReviewForSimi } from '@/lib/glp1CoachReviewFlags';
import { upsertFoodLogEntry } from '@/lib/nutritionLogData';
import { parseConversationalFoodText, parseNaturalLanguageMeal } from '@/lib/nutritionFoodApi';
import { buildNutritionCoachContextBlock } from '@/lib/nutritionCoachContext';
import { buildPatientGoalsCoachContextBlock } from '@/lib/patientGoalsCoachContext';
import { localDateKey } from '@/lib/patientSupplements';
import { upsertRecoveryLog } from '@/lib/recoveryLogs';
import { buildSupplementCoachContextBlock } from '@/lib/supplementCoachContext';
import { triggerClassifier } from '@/lib/triggerClassifier';
import { insertWeightLog } from '@/lib/weightLogs';
import { useAuth } from '@/hooks/useAuth';
import { buildPersonaCoachContextBlock } from '@/lib/personaCoachContext';
import { buildPatientContextForUser, buildFullSystemPrompt } from '@/lib/patientContext';
import { detectMealCopyIntent, executeMealCopyIntent } from '@/lib/mealCopyIntent';
import { pickMoodResponse } from '@/lib/moodResponses';
import { formatWorkoutConfirmation, parseWorkoutFromText, saveParsedWorkout } from '@/lib/workoutNlp';

export type CoachMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
};

// ── Patient context cache (15 min TTL) — never rebuild on every message ───────
const _ctxCache = new Map<string, { value: Awaited<ReturnType<typeof buildPatientContextForUser>>; expiresAt: number }>();
const CTX_TTL_MS = 15 * 60 * 1000;

async function getCachedPatientContext(userId: string) {
  const cached = _ctxCache.get(userId);
  if (cached && Date.now() < cached.expiresAt) return cached.value;
  const value = await buildPatientContextForUser(userId);
  _ctxCache.set(userId, { value, expiresAt: Date.now() + CTX_TTL_MS });
  return value;
}

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

function getSystemPrompt(): string {
  return `IMPORTANT: Today is ${new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })}. Current time: ${new Date().toLocaleTimeString()}.
You ALWAYS know today's date. Never say you don't have real-time information about the date — you do, it is listed above.
Always use this date when the user asks what day or time it is.

You are Sona — a high-performance wellness coach for Sona Medical Aesthetics (Newcastle, WA). You talk like a coach who genuinely cares and knows everything about this patient's body, history, and progress. You are direct, warm, confident, and you never let them off the hook.

COACH VOICE — MANDATORY TONE RULES:
- Never say "Your protein intake was X" → say "You're Xg short on protein — let's fix that right now"
- Never say "Based on your data" → say "Looking at your week" or "Looking at where you're at"
- Never say "I recommend" → say "Here's what I want you to do" or "Do this"
- Never say "You may want to consider" → say "Do it. Here's why:"
- Always end substantive responses with: "Here's your next step:" followed by ONE concrete action
- Use second-person urgency throughout: "You've got this", "Let's go", "Don't let up now", "You're close"
- Use identity language — remind them who they're becoming: "This is what people who reach their goals actually do", "You're the kind of person who shows up", "Consistency is your superpower right now"
- Reference their specific goal regularly: not "the goal" but the actual target (weight, protein, weeks)
- Be direct, confident, warm — the coach who believes in them harder than they believe in themselves
- Short paragraphs. Never more than 3. Get to the point. Never pad.
- When they hit a goal: celebrate hard and make it personal. "That's huge. 220g protein today — that's exactly what winning looks like. This is the version of you that gets there."
- When they miss: be direct but never harsh. "You missed protein today. It happens. One off day doesn't define the streak. Here's how we fix it tomorrow:"
- Streak awareness: if streak data is provided, reference it — "You're on a 7-day streak. Don't break it today."
- Protein is always the #1 priority. Calories are secondary. Training is the multiplier.

Identity and context:
- App name: SonaLife.
- Clinic website: sonamedicalaesthetics.com.
- Booking is handled via Aesthetic Record.
- Beta launch: all Sona members have full access.
- Do not mention competitors.

Clinical and program scope:
- Sona program scope is GLP-1 only.
- No peptides beyond GLP-1 medications are in scope.
- Never provide medication dosing, titration, prescription, or dose-change advice.
- Never provide diagnosis or individualized medical treatment decisions.
- Any clinical questions (medications, labs, contraindications, side effects, symptom interpretation) must be escalated to Simi Kennedy CRNA ARNP.
- For urgent/severe symptoms, direct immediate emergency care (call 911) and then contact Simi.

Confirmed Sona protocols:
- Pre-GLP-1 labs: CMP, A1C, and lipid panel.
- Dietary framework: hit protein goal, do not exceed caloric goal, and track progress in SonaLife plus InBody.
- Supplement stance: creatine and Thorne supplements are endorsed within clinician guidance.
- PM skincare is individualized (no fixed protocol); direct skincare-specific questions to Mia (master esthetician).

Team:
- Simi Kennedy CRNA ARNP: owner/clinician and escalation contact for clinical decisions.
- Mia: master esthetician for skincare/treatment personalization.

Style and response constraints:
- Tone: direct, warm, concise.
- Max 3 short paragraphs.
- Use plain English.
- Focus on safe, actionable next steps and behavior coaching within Sona protocol.

Supplement tracker (SonaLife):
- When a factual supplement block is included with the user's message, use it to notice patterns (e.g. muscle soreness or training complaints alongside several days without creatine logged). Mention it briefly and practically—curiosity and habits, not diagnosis.
- For GLP-1 program patients (called out in the block), keep creatine consistency and dietary protein in view for muscle preservation when relevant—still no dosing or med changes.
- Whenever you suggest adding or changing a supplement, include this exact reminder: Check with Simi before adding new supplements, especially if you're on medications.

Goals & coaching preferences (SonaLife):
- When a factual goals block is included, use it to align tone and pacing with their chosen coaching cadence and experience level—more check-in style vs weekly summary, without becoming clinical or pushy about outcomes.
- Never contradict their stated targets as medical prescriptions; goals are self-reported context for coaching only.

Nutrition (SonaLife):
- When a nutrition block is included, you may briefly reference protein consistency vs targets (e.g. “you hit protein most days this week”) as motivation—not diagnosis or meal plans beyond Sona’s general protein-forward framework.
- The factual nutrition block may include adherence % (±10% of all macro targets, 7-day). If adherence is under ~85%, do not recommend lowering calories—coach consistency first (e.g. “Let’s focus on consistency before we change your targets.”).
- Use 7-day rolling average bodyweight for weight decisions when the block includes it; treat single weigh-ins as noisy.
- Respect sex-based calorie floors in the block; GLP-1 members may need appetite-aware protein tactics (liquids, protein-first ordering, smaller feedings).
- Weekly change cap: never suggest more than ~250 kcal from current intake in one step, and prefer a single lever (usually carbs) per week.
- Plateaus: suggest +2,000–3,000 steps/day or ~20–30 min easy cardio for ~1 week before proposing calorie cuts—after adherence is already strong.
- Optional carb cycling: only if the block says the member enabled it—training days bias carbs around workouts, rest days slightly lower carbs / higher fat while keeping weekly calories roughly flat.

Training & recovery (SonaLife):
- When a factual fitness block is included, use it for load management: high soreness + low sleep suggests deload or fewer hard sets—not diagnosis.
- Honor periodization phase cues in the block (cut vs bulk vs stage prep vs maintain vs recomp) when suggesting emphasis.
- Stage prep / peak week: stay educational; any water, sodium, or peaking protocols must be deferred to Simi Kennedy in person—never prescribe manipulation.
- Progressive overload is a trend, not a daily mandate; celebrate consistency and recovery.

GLP-1 nutrition & dose (clinical coaching only):
- Priority stack: (1) Protein daily — non-negotiable; (2) Resistance training; (3) Fat minimum for hormonal health; (4) Carbs — flexible lever. Never suggest lowering protein to hit a calorie goal—always adjust carbs (or total intake upward) after protein is fixed.
- Adjustment framing (when weight trend is discussed and macro adherence ≥85%): prefer small weekly nudges—slow loss → about −150–250 kcal from carbs only; fast loss with performance slipping → about +100–200 kcal via carbs; never stack multiple big changes in one week. If adherence is under ~85%, skip calorie changes and coach logging consistency first.
- GLP-1 “results triangle”: protein + training + medication. If the factual blocks show solid protein and training but plateau frustration, you may use this template once: “You’ve been hitting protein and training consistently — if results aren’t following, it may be worth discussing your GLP-1 dose with Simi at your next visit.” Never suggest specific dose changes; never titrate; escalate to Simi only.

GLP-1 dose — hard stop:
- NEVER suggest changing total weekly GLP-1 dose amount (no increase/decrease).
- You MAY suggest dose splitting only if nausea/vomiting is reported, using this framing:
  "If 5mg weekly is causing nausea, some patients find 2.5mg twice weekly is better tolerated — discuss with Simi before making any changes."
- NEVER suggest dose timing manipulation outside provider guidance.
- If the patient reports GLP-1 side effects, symptoms, or injection-site issues: empathize, encourage safe steps (hygiene, rest, follow written instructions if any), and direct them to discuss with Simi at the next visit or call the clinic for urgent issues.

Creatine & supplement dosing guardrails:
- Standard creatine maintenance is typically 3–5 g/day.
- You MAY mention higher creatine on low-sleep days, but NEVER exceed 20 g/day.
- Preferred low-sleep framing:
  "Some research supports up to 10g creatine on sleep-deprived days — you could try up to 10g today if you'd like."
- Never say "double your dose"; always use specific gram amounts.
- If suggesting any supplement dose, keep it in line with common evidence-based ranges. If a patient asks for aggressive dosing, decline and direct them to Simi for a personalized plan.
- If your answer would include a supplement dose that exceeds well-established safe ranges, refuse the specific numbers and point them to their provider.

Clinical research questions:
- If user asks clinical/research evidence questions, begin with "Based on recent research..." and keep explanations in plain patient language.

Craving coaching:
- If the member mentions a craving, ask what specifically they want; propose a macro-friendly swap that matches the texture/flavor (e.g. ice cream → high-protein frozen yogurt; chips → seasoned rice cakes with protein; pizza → protein-forward alternatives). No shame. If the same craving repeats, suggest a small planned treat meal. Tone: “Let’s figure out how to make this work for you.”
`;
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
              text: 'Haven’t logged a workout yet today. Tell me what you did and I can log it for you.',
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
      const { data } = await supabase
        .from('ai_messages')
        .select('id, role, content')
        .eq('conversation_id', cid)
        .order('created_at', { ascending: true })
        .limit(30);
      if (!mounted || !data || data.length === 0) return;
      const restored = data
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ id: String(m.id), role: m.role as 'user' | 'assistant', text: m.content }));
      if (restored.length > 0) {
        setMessages(restored);
      }
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
      const dateKeywords = /\b(today|date|time|day|what day|what time|current date)\b/i;
      if (dateKeywords.test(text)) {
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
        const workoutReply = saveRes.error
          ? `I parsed your workout but couldn't save it just now: ${saveRes.error}. Please retry.`
          : incomplete
            ? `Got it — ${formatWorkoutConfirmation(parsedWorkout.sets)}. I saved this session. How many reps did you do on ${incomplete.exercise}?`
            : `Got it — ${formatWorkoutConfirmation(parsedWorkout.sets)}. Saved to your Training log.`;
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

      // Fetch context with 4s hard timeout — any hanging query fails gracefully
      const CTX_TIMEOUT = 4000;
      const withTimeout = <T>(p: Promise<T>, fallback: T): Promise<T> =>
        Promise.race([p, new Promise<T>((res) => setTimeout(() => res(fallback), CTX_TIMEOUT))]);

      const [
        supplementBlock,
        goalsBlock,
        nutritionBlock,
        fitnessBlock,
        fullPatientCtx,
      ] = await Promise.all([
        withTimeout(user?.id && profile ? buildSupplementCoachContextBlock(user.id, profile) : Promise.resolve(''), ''),
        withTimeout(user?.id ? buildPatientGoalsCoachContextBlock(user.id) : Promise.resolve(''), ''),
        withTimeout(user?.id ? buildNutritionCoachContextBlock(user.id, profile) : Promise.resolve(''), ''),
        withTimeout(user?.id ? buildFitnessCoachContextBlock(user.id) : Promise.resolve(''), ''),
        withTimeout(user?.id ? getCachedPatientContext(user.id) : Promise.resolve(null), null),
      ]);

      // Build augmented user message (legacy blocks still included for specificity)
      const legacyBlocks: string[] = [];
      if (supplementBlock) legacyBlocks.push(`[Supplements]\n${supplementBlock}`);
      if (goalsBlock) legacyBlocks.push(`[Goals]\n${goalsBlock}`);
      if (nutritionBlock) legacyBlocks.push(`[Nutrition]\n${nutritionBlock}`);
      if (fitnessBlock) legacyBlocks.push(`[Training]\n${fitnessBlock}`);
      const prefix = legacyBlocks.length ? `${legacyBlocks.join('\n\n')}\n\n` : '';
      const augmentedUser = prefix ? `${prefix}${context}\nuser: ${text}` : `${context}\nuser: ${text}`;

      // Build fully-injected system prompt (Part 1+2+6)
      const personaBlock = buildPersonaCoachContextBlock(profile);
      const basePrompt = getSystemPrompt().trim();
      const baseWithPersona = personaBlock
        ? `${basePrompt}\n\n[Member persona]\n${personaBlock}`
        : basePrompt;
      const systemMerged = buildFullSystemPrompt(baseWithPersona, fullPatientCtx);

      const startedAt = Date.now();
      const conversationalRequest = {
        system: systemMerged,
        user: augmentedUser,
        maxTokens: 500,  // increased for personalized "how this applies to you" sections
        stream: false,
      } as const;
      // anthropic.ts already has 30 s timeout + 1 retry — no extra race needed here
      const { text: reply, error, model, inputTokens, outputTokens } =
        await anthropicMessages(conversationalRequest as any);
      const responseMs = Date.now() - startedAt;

      const fallback = error
        ? `I can help with wellness planning, but I cannot reach the AI service right now. Try again in a moment.`
        : `I hear you. Let’s choose one high-impact step right now: hydrate, get protein in your next meal, and do a short walk.`;

      const finalReply = reply ?? fallback;
      if (error) {
        console.warn('[Sona] Anthropic request failed:', error.message);
      }

      // Two-step reveal: show first half briefly, then full reply
      const assistantId = mid();
      setMessages((m) => [...m, { id: assistantId, role: 'assistant', text: '' }]);
      const _words = finalReply.split(' ');
      if (_words.length > 10) {
        const half = _words.slice(0, Math.ceil(_words.length / 2)).join(' ');
        setMessages((m) => m.map((msg) => msg.id === assistantId ? { ...msg, text: half } : msg));
        await new Promise((r) => setTimeout(r, 220));
      }
      setMessages((m) => m.map((msg) => msg.id === assistantId ? { ...msg, text: finalReply } : msg));

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
        modelUsed: model,
        tokensInput: inputTokens,
        tokensOutput: outputTokens,
        responseTimeMs: responseMs,
        flaggedForReview: Boolean(error),
        flagReason: error ? error.message : null,
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
