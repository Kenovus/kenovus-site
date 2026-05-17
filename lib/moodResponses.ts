export const MOOD_RESPONSES = {
  great: [
    "Let's make today count! 💪",
    "Love that energy — let's go!",
    "You're fired up today. Channel it.",
    "That's what I like to hear!",
    "Amazing! Let's build on that.",
    "Top of your game today. Let's use it.",
    "Incredible. Nothing can stop you today.",
    "That energy is contagious. Let's go!",
    "Love it. Big day ahead.",
    "Perfect. Let's get after it.",
  ],
  good: [
    "Solid! Let's build on it.",
    'Good energy today.',
    "That works. Let's go.",
    "Good place to be. Let's keep it moving.",
    "Solid foundation. Let's stack on it.",
    "That's a good spot. Let's work with it.",
    'Good. Consistency is everything.',
    "Nice. Let's make it count.",
    "That's the sweet spot. Let's go.",
    "Good day ahead. Let's build.",
  ],
  okay: [
    "Every day counts. Let's start small.",
    "That's okay — consistency wins.",
    "Let's make today better than yesterday.",
    'Okay is a great starting point.',
    "That's honest. Let's work with it.",
    'One step at a time today.',
    'Okay days matter too. Let\'s go.',
    'Every rep counts, even on okay days.',
    "Let's make something good happen today.",
    "That's real. Let's move forward.",
  ],
  tired: [
    'Rest is part of the process.',
    'Honor where you are today.',
    "Even tired days matter. Let's be gentle.",
    "Your body is talking — let's listen.",
    'Low energy days still count.',
    'Rest and recovery are progress too.',
    "That's okay. Let's do what we can.",
    'Tired but here. That\'s what matters.',
    "Let's keep it light today.",
    "Recovery is training. You're still winning.",
  ],
  anxious: [
    "Take a breath. You've got this.",
    'One thing at a time today.',
    "Let's start small and build from there.",
    "That feeling is valid. Let's work through it.",
    "You're here. That's the first step.",
    "Let's focus on just one thing right now.",
    'Breathe. Then we take it one step at a time.',
    "Anxiety means you care. Let's channel it.",
    "You've handled hard things before. This too.",
    "Let's make today manageable.",
  ],
} as const;

export type MoodId = keyof typeof MOOD_RESPONSES;

export function pickMoodResponse(mood: MoodId): string {
  const responses = MOOD_RESPONSES[mood];
  return responses[Math.floor(Math.random() * responses.length)] ?? "Let's take it one step at a time.";
}
