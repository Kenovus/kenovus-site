import { supabase } from '@/lib/supabase';
import { insertTrainingLog, type TrainingExercise } from '@/lib/trainingLogs';
import { fetchDailyWins, upsertDailyWins } from '@/lib/dailyWins';

type ParsedSet = {
  exercise: string;
  sets: number;
  reps: number | null;
  weight: number | null;
};

function cleanExerciseName(name: string): string {
  return name
    .replace(/\bthen\b/gi, '')
    .replace(/\bI did\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Parses workout text. Handles multiple common formats:
 *  "3 sets of squats at 225 lbs, 10 reps"
 *  "squats 3 sets of 225 for 10 reps"
 *  "squats: 3x10 @ 225"
 *  "squats 3x10 225 lbs"
 */
export function parseWorkoutFromText(text: string): { sets: ParsedSet[]; notes: string } {
  const results: ParsedSet[] = [];

  // Pattern 1: "3 sets of [exercise] at [weight] lbs, [reps] reps"
  const p1 = [...text.matchAll(
    /(\d+)\s*sets?\s+of\s+([a-zA-Z][a-zA-Z0-9\s-]+?)\s+at\s+(\d+)\s*(?:lb|lbs|pounds|kg)?(?:[,\s]+(\d+)\s*reps?)?/gi,
  )];
  for (const m of p1) {
    results.push({ sets: Number(m[1]), exercise: cleanExerciseName(String(m[2])), weight: m[3] ? Number(m[3]) : null, reps: m[4] ? Number(m[4]) : null });
  }

  // Pattern 2: "[exercise] [sets] sets of [weight] for [reps] reps"  e.g. "squats 3 sets of 225 for 10 reps"
  if (results.length === 0) {
    const p2 = [...text.matchAll(
      /([a-zA-Z][a-zA-Z\s-]{2,30}?)\s+(\d+)\s*sets?\s+(?:of\s+)?(\d+)\s*(?:lb|lbs|pounds|kg)?\s+(?:for|x|×|@|at)\s*(\d+)\s*reps?/gi,
    )];
    for (const m of p2) {
      results.push({ exercise: cleanExerciseName(String(m[1])), sets: Number(m[2]), weight: m[3] ? Number(m[3]) : null, reps: m[4] ? Number(m[4]) : null });
    }
  }

  // Pattern 3: "[exercise]: [sets]x[reps] @ [weight]"  e.g. "squats: 3x10 @ 225"
  if (results.length === 0) {
    const p3 = [...text.matchAll(
      /([a-zA-Z][a-zA-Z\s-]{2,30}?)\s*[:-]\s*(\d+)\s*[x×]\s*(\d+)\s*(?:@|at)?\s*(\d+)?\s*(?:lb|lbs|pounds|kg)?/gi,
    )];
    for (const m of p3) {
      results.push({ exercise: cleanExerciseName(String(m[1])), sets: Number(m[2]), reps: m[3] ? Number(m[3]) : null, weight: m[4] ? Number(m[4]) : null });
    }
  }

  return { sets: results, notes: text.trim() };
}

export async function saveParsedWorkout(params: {
  patientId: string;
  parsed: ParsedSet[];
  notes: string;
}): Promise<{ error: string | null }> {
  const exercises: TrainingExercise[] = params.parsed.map((p) => ({
    name: p.exercise,
    set_rows: Array.from({ length: Math.max(1, p.sets) }, () => ({
      reps: p.reps ?? 8,
      weight: p.weight ?? 0,
      rir: 2,
    })),
  }));

  // Detect muscle group from exercise names for the muscle_focus field
  const allExercises = params.parsed.map((p) => p.exercise.toLowerCase()).join(' ');
  let muscleFocus = 'full_body';
  if (/squat|leg press|lunge|deadlift|hamstring|quad/.test(allExercises)) muscleFocus = 'legs';
  else if (/bench|chest|fly|pec/.test(allExercises)) muscleFocus = 'chest';
  else if (/row|pull.up|lat|back|deadlift/.test(allExercises)) muscleFocus = 'back';
  else if (/press|delt|shoulder|lateral/.test(allExercises)) muscleFocus = 'shoulders';
  else if (/curl|tricep|arm|bicep/.test(allExercises)) muscleFocus = 'arms';

  const { error } = await insertTrainingLog({
    patientId: params.patientId,
    workout_date: new Date().toISOString().slice(0, 10),
    muscle_focus: muscleFocus,
    exercises,
    duration_minutes: null,
    notes: params.notes || null,
    weight_unit: 'lb',
  });

  if (!error) {
    // Mark training_done in daily_wins for today
    const today = new Date().toISOString().slice(0, 10);
    try {
      const existing = await fetchDailyWins(params.patientId, today);
      await upsertDailyWins(params.patientId, today, {
        protein_hit: existing.protein_hit,
        training_done: true,
        steps_hit: existing.steps_hit,
      });
    } catch (e) {
      console.warn('[workoutNlp] daily_wins update failed:', e);
    }
  }

  return { error };
}

export function formatWorkoutConfirmation(parsed: ParsedSet[]): string {
  return parsed
    .map((p) => `${p.exercise} ${p.sets}×${p.reps != null ? p.reps : '?'} @ ${p.weight != null ? p.weight : '?'}lbs`)
    .join(', ');
}
