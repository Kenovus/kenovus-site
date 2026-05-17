import { anthropicMessages } from '@/lib/anthropic';
import { logAIAudit } from '@/lib/aiAudit';
import { countUserCoachMessagesToday } from '@/lib/aiUsage';
import { getDailyAiUserMessageCap } from '@/lib/consumerTier';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { supabase } from '@/lib/supabase';
import { triggerClassifier } from '@/lib/triggerClassifier';
import type { UserProfile } from '@/types/user';

const ACK_SYSTEM = `You are the SonaLife wellness coach. The user just shared a quick mood check-in from their daily greeting (not a clinical request).

Core reply: warm, personal (use their first name), acknowledge what they shared without minimizing it, and offer one gentle encouragement or a tiny next step. No bullet lists. No medical or dosing advice.

Heavy or draining moods: If their mood or note sounds depleted, worried, or like a hard day (e.g. exhausted, anxious, rough day, overwhelmed, burnt out, low, stressed, or “so-so” with struggle in the note), add a brief confident closing line after your acknowledgment—coach-like and steady, not clinical. Examples of tone (do not copy verbatim every time): “You showed up today—that’s what matters. Let’s make it count.” or “One step at a time. I’m with you.” The closing should feel like a mic-drop reassurance, not therapy jargon.

Keep the full message under ~420 characters and at most 4 short sentences.`;

async function ensureCoachConversationId(
  authUserId: string,
  clinicId: string | null,
): Promise<string | null> {
  const patientId = await fetchPatientIdForAuthUser(authUserId);
  if (!patientId) return null;

  const { data: existing } = await supabase
    .from('ai_conversations')
    .select('id')
    .eq('patient_id', patientId)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created } = await supabase
    .from('ai_conversations')
    .insert({
      patient_id: patientId,
      clinic_id: clinicId,
      title: 'My Coach',
    })
    .select('id')
    .maybeSingle();
  return created?.id ?? null;
}

function isHeavyMood(moodLabel: string, optionalNote: string): boolean {
  const t = `${moodLabel}\n${optionalNote}`.toLowerCase();
  return /\b(exhaust|anxious|rough|so-so|overwhelm|burnout|depress|hopeless|panic|stressed|low|drain|empty|heavy)\b/i.test(
    t,
  );
}

/** If the model skipped a closing, add one for heavier check-ins. */
function ensureHeavyMoodClosing(text: string, moodLabel: string, optionalNote: string): string {
  if (!isHeavyMood(moodLabel, optionalNote)) return text;
  const tail = text.slice(-140).toLowerCase();
  if (
    /showed up|one step at a time|i['’]m with you|what matters|make it count|here with you|got you/.test(
      tail,
    )
  ) {
    return text;
  }
  return `${text.trim()} You showed up today—that's what matters. Let's make it count.`;
}

function fallbackAck(firstName: string, moodLabel: string, optionalNote: string): string {
  const name = firstName.trim() || 'there';
  if (isHeavyMood(moodLabel, optionalNote)) {
    return `${name}, thanks for saying it out loud—that takes guts on a heavy day. Go easy on yourself; one small win still counts. You showed up today—that's what matters. Let's make it count.`;
  }
  return `${name}, I'm glad you checked in. Carry that energy into today, and we'll keep building momentum step by step.`;
}

/**
 * Records the daily mood in My Coach and returns a brief warm acknowledgment (AI or safe fallback).
 */
export async function sendDailyMoodAcknowledgment(params: {
  authUserId: string;
  profile: UserProfile;
  firstName: string;
  moodLabel: string;
  optionalNote: string;
}): Promise<{ reply: string; hitCap?: boolean }> {
  const { authUserId, profile, firstName, moodLabel, optionalNote } = params;
  const patientId = await fetchPatientIdForAuthUser(authUserId);
  const cap = getDailyAiUserMessageCap(profile);
  if (patientId && Number.isFinite(cap)) {
    const used = await countUserCoachMessagesToday(patientId);
    if (used >= cap) {
      return {
        reply: `${firstName.trim() || 'there'}, I’ve got you—today’s coach message limit is reached, but I’m still glad you shared. We’ll pick this up in My Coach tomorrow.`,
        hitCap: true,
      };
    }
  }

  const userLine = `[Daily greeting — how I'm feeling]\nMood: ${moodLabel}\n${optionalNote.trim() ? `More: ${optionalNote.trim()}` : '(no extra note)'}`;
  const classification = triggerClassifier(`${moodLabel}\n${optionalNote}`);
  if (classification.triggered && classification.response) {
    return { reply: classification.response };
  }

  if (!patientId) {
    return { reply: fallbackAck(firstName, moodLabel, optionalNote) };
  }

  const cid = await ensureCoachConversationId(authUserId, profile.clinic_id ?? null);
  if (cid) {
    await supabase.from('ai_messages').insert({
      conversation_id: cid,
      role: 'user',
      content: userLine,
    });
  }
  await logAIAudit({
    patientId,
    clinicId: profile.clinic_id ?? null,
    sessionId: cid,
    role: 'user',
    content: userLine,
  });

  const startedAt = Date.now();
  const { text: reply, error, model, inputTokens, outputTokens } = await anthropicMessages({
    system: ACK_SYSTEM,
    user: `First name: ${firstName.trim() || 'friend'}.\nThey chose or wrote: ${userLine}`,
    maxTokens: 220,
  });
  const responseMs = Date.now() - startedAt;

  const draft = reply?.trim() || fallbackAck(firstName, moodLabel, optionalNote);
  const finalReply = ensureHeavyMoodClosing(draft, moodLabel, optionalNote).slice(0, 520);

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
    clinicId: profile.clinic_id ?? null,
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

  if (error) {
    console.warn('[daily mood ack] Anthropic failed:', error.message);
  }

  return { reply: finalReply };
}
