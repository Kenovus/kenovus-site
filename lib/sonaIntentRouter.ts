interface SonaIntent {
  type: 'navigate' | 'conversational';
  route?: string;
  params?: Record<string, string>;
  confirmationMessage?: string;
}

export function routeSonaIntent(transcript: string): SonaIntent {
  const t = transcript.toLowerCase().trim();

  if (t.includes('log breakfast') || t.includes('breakfast')) {
    return {
      type: 'navigate',
      route: '/patient/nutrition/log',
      params: { meal: 'breakfast' },
      confirmationMessage: 'Opening breakfast log...',
    };
  }
  if (t.includes('log lunch') || t.includes('what i had for lunch')) {
    return {
      type: 'navigate',
      route: '/patient/nutrition/log',
      params: { meal: 'lunch' },
      confirmationMessage: 'Opening lunch log...',
    };
  }
  if (t.includes('log dinner') || t.includes('what i had for dinner')) {
    return {
      type: 'navigate',
      route: '/patient/nutrition/log',
      params: { meal: 'dinner' },
      confirmationMessage: 'Opening dinner log...',
    };
  }
  if (t.includes('pre-workout') || t.includes('pre workout')) {
    return {
      type: 'navigate',
      route: '/patient/nutrition/log',
      params: { meal: 'pre_workout' },
      confirmationMessage: 'Opening pre-workout log...',
    };
  }
  if (t.includes('post-workout') || t.includes('post workout')) {
    return {
      type: 'navigate',
      route: '/patient/nutrition/log',
      params: { meal: 'post_workout' },
      confirmationMessage: 'Opening post-workout log...',
    };
  }

  const hadMatch = t.match(/i had (.+)|i ate (.+)|add (.+) to/);
  if (hadMatch) {
    const food = hadMatch[1] || hadMatch[2] || hadMatch[3];
    const meal = t.includes('breakfast')
      ? 'breakfast'
      : t.includes('lunch')
        ? 'lunch'
        : t.includes('dinner')
          ? 'dinner'
          : t.includes('snack')
            ? 'snack'
            : 'auto';
    return {
      type: 'navigate',
      route: '/patient/nutrition/log',
      params: { meal, search: food, voiceAdd: '1', voiceText: transcript },
      confirmationMessage: `Got it — logging ${food}...`,
    };
  }

  if (
    t.includes('log food') ||
    t.includes('log meal') ||
    t.includes('what i ate') ||
    t.includes('log what i')
  ) {
    return {
      type: 'navigate',
      route: '/patient/nutrition',
      confirmationMessage: 'Opening nutrition...',
    };
  }

  const weightMatch = t.match(/i weigh (\d+)|log.*weight|weight.*log/);
  if (weightMatch) {
    const weight = weightMatch[1];
    return {
      type: 'navigate',
      route: '/patient/progress/weight',
      params: weight ? { prefill: weight } : {},
      confirmationMessage: weight ? `Got it — logging ${weight} lbs...` : 'Opening weight log...',
    };
  }

  const workoutMatch = t.match(/i did (.+)|log.*workout|log.*training|log.*exercise/);
  if (workoutMatch) {
    const exercise = workoutMatch[1];
    return {
      type: 'navigate',
      route: '/patient/progress/training',
      params: exercise ? { prefill: exercise } : {},
      confirmationMessage: 'Opening training log...',
    };
  }

  if (t.includes('show my progress') || t.includes('how am i doing') || t.includes('my charts')) {
    return {
      type: 'navigate',
      route: '/patient/progress',
      confirmationMessage: 'Opening your progress...',
    };
  }

  if (t.includes('log supplement') || t.includes('log vitamin') || t.includes('my supplements')) {
    return {
      type: 'navigate',
      route: '/patient/profile/supplements',
      confirmationMessage: 'Opening supplements...',
    };
  }

  if (t.includes('go home') || t.includes('home screen')) {
    return {
      type: 'navigate',
      route: '/patient/home',
      confirmationMessage: 'Going home...',
    };
  }

  return { type: 'conversational' };
}

export type { SonaIntent };
