import { supabase } from '@/lib/supabase';

export type AuditRole = 'user' | 'assistant';

export async function logAIAudit(params: {
  patientId: string | null;
  clinicId: string | null;
  sessionId: string | null;
  role: AuditRole;
  content: string;
  triggerDetected?: boolean;
  triggerCategory?: string | null;
  modelUsed?: string | null;
  tokensInput?: number | null;
  tokensOutput?: number | null;
  responseTimeMs?: number | null;
  flaggedForReview?: boolean;
  flagReason?: string | null;
  emergencyOverlayShown?: boolean;
  emergencyUserAction?: 'call_911' | 'dismissed' | null;
}) {
  if (!params.patientId) return;
  const { error } = await supabase.from('ai_audit_log').insert({
    patient_id: params.patientId,
    clinic_id: params.clinicId ?? null,
    session_id: params.sessionId ?? null,
    message_role: params.role,
    message_content: params.content,
    trigger_detected: params.triggerDetected ?? false,
    trigger_category: params.triggerCategory ?? null,
    model_used: params.modelUsed ?? null,
    tokens_input: params.tokensInput ?? null,
    tokens_output: params.tokensOutput ?? null,
    response_time_ms: params.responseTimeMs ?? null,
    flagged_for_review: params.flaggedForReview ?? false,
    flag_reason: params.flagReason ?? null,
    emergency_overlay_shown: params.emergencyOverlayShown ?? false,
    emergency_user_action: params.emergencyUserAction ?? null,
  });
  if (error) {
    console.warn('[ai_audit_log] insert failed', error.message);
  }
}
