import { logAIAudit } from '@/lib/aiAudit';
import { canUseGlp1PatientFeatures } from '@/lib/consumerTier';
import type { UserProfile } from '@/types/user';

/** GLP-1: if logged intake is sustained under the evidence-based floor, flag Simi for chart review (no auto med changes). */
export async function maybeFlagGlp1IntakeBelowFloor(params: {
  patientId: string;
  clinicId: string | null;
  profile: UserProfile | null;
  hardCalorieFloorKcal: number;
  avgIntake7d: number | null;
  daysWithLogs: number;
}): Promise<void> {
  const { patientId, clinicId, profile, hardCalorieFloorKcal, avgIntake7d, daysWithLogs } = params;
  if (!patientId || !canUseGlp1PatientFeatures(profile)) return;
  if (avgIntake7d == null || daysWithLogs < 5) return;
  if (avgIntake7d >= hardCalorieFloorKcal - 75) return;

  await logAIAudit({
    patientId,
    clinicId,
    sessionId: null,
    role: 'assistant',
    content: `[GLP-1 nutrition] Member 7d avg logged intake ~${Math.round(avgIntake7d)} kcal vs floor ${hardCalorieFloorKcal} kcal (${daysWithLogs} days with logs). Flag for Simi: appetite suppression / intake risk.`,
    triggerDetected: true,
    triggerCategory: 'glp1_low_intake_floor',
    flaggedForReview: true,
    flagReason: 'glp1_sustained_intake_below_floor',
  });
}
