import { EMERGENCY_KEYWORDS } from '@/constants/emergency';

export type TriggerCategory =
  | 'dosing_change'
  | 'severe_symptoms'
  | 'lab_interpretation'
  | 'mental_health_crisis'
  | 'prescription_request';

export interface ClassifierResult {
  triggered: boolean;
  category: TriggerCategory | null;
  response: string | null;
}

const triggers: Array<{
  category: TriggerCategory;
  patterns: RegExp[];
  response: string;
}> = [
  {
    category: 'dosing_change',
    patterns: [
      /should i (increase|decrease|change|adjust) my dose/i,
      /can i take more/i,
      /skip my injection/i,
      /change my (semaglutide|ozempic|wegovy|mounjaro|zepbound)/i,
    ],
    response:
      'Medication decisions need to come directly from your provider. Tap Contact Provider and send this to your care team now.',
  },
  {
    category: 'severe_symptoms',
    patterns: [/chest pain/i, /can'?t breathe/i, /severe vomiting/i, /passing out/i],
    response:
      'This may need immediate attention. If this feels urgent, call 911 now. Then contact your provider directly.',
  },
  {
    category: 'lab_interpretation',
    patterns: [
      /what does my (a1c|cholesterol|lab|result)/i,
      /is my (cholesterol|glucose|a1c|triglyceride) (bad|high|low|normal)/i,
      /interpret my results/i,
    ],
    response:
      'Your provider is the right person to interpret lab results with your full clinical context. Tap Contact Provider and I will route this.',
  },
  {
    category: 'mental_health_crisis',
    patterns: [/want to hurt myself/i, /suicidal/i, /end my life/i, /don'?t want to be here/i],
    response:
      'I am really glad you said this. Please call or text 988 right now for immediate support. You can also text HOME to 741741. I recommend contacting your provider now too.',
  },
  {
    category: 'prescription_request',
    patterns: [/can you prescribe/i, /write me a prescription/i, /i need a refill/i],
    response:
      'Prescriptions and refills must come directly from your provider. Tap Contact Provider to send this now.',
  },
];

export function triggerClassifier(message: string): ClassifierResult {
  const lower = message.toLowerCase();
  if (EMERGENCY_KEYWORDS.some((kw) => lower.includes(kw))) {
    return {
      triggered: true,
      category: 'severe_symptoms',
      response:
        'This may need immediate attention. If this feels urgent, call 911 now. Then contact your provider directly.',
    };
  }
  for (const trigger of triggers) {
    if (trigger.patterns.some((p) => p.test(lower))) {
      return { triggered: true, category: trigger.category, response: trigger.response };
    }
  }
  return { triggered: false, category: null, response: null };
}
