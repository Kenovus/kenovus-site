import { insertTrainingLog, type TrainingExercise } from '@/lib/trainingLogs';

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

export function parseWorkoutFromText(text: string): { sets: ParsedSet[]; notes: string } {
  const matches = [...text.matchAll(/(\d+)\s*sets?\s+of\s+([a-zA-Z0-9\s-]+?)\s+at\s+(\d+)\s*(?:lb|lbs|pounds)?(?:,\s*(\d+)\s*reps?)?/gi)];
  const sets: ParsedSet[] = matches.map((m) => ({
    sets: Number(m[1] ?? 0),
    exercise: cleanExerciseName(String(m[2] ?? 'Exercise')),
    weight: m[3] ? Number(m[3]) : null,
    reps: m[4] ? Number(m[4]) : null,
  }));
  return { sets, notes: text.trim() };
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
  const { error } = await insertTrainingLog({
    patientId: params.patientId,
    workout_date: new Date().toISOString().slice(0, 10),
    muscle_focus: 'full_body',
    exercises,
    duration_minutes: null,
    notes: params.notes || null,
    weight_unit: 'lb',
  });
  return { error };
}

export function formatWorkoutConfirmation(parsed: ParsedSet[]): string {
  return parsed
    .map((p) => `${p.exercise} ${p.sets}x${p.reps != null ? p.reps : '?'} @ ${p.weight != null ? p.weight : '?'}lbs`)
    .join(', ');
}
