export type TriageLayer = 1 | 2 | 3;

export type TriageResult = {
  layer: TriageLayer;
  confidenceScore: number;
  escalationReason: string | null;
  aiDraft: string | null;
  urgent: boolean;
  keywords: string[];
};

const LAYER_3_PATTERNS: RegExp[] = [
  /is this serious/i,
  /should i go to the er/i,
  /i'?m scared/i,
  /something feels wrong/i,
  /can'?t breathe/i,
  /chest pain/i,
  /severe/i,
  /emergency/i,
];

const LAYER_2_PATTERNS: RegExp[] = [
  /lab/i,
  /result/i,
  /dose change/i,
  /prescription/i,
  /refill/i,
  /red after \d+ days/i,
  /infection/i,
];

const LAYER_1_PATTERNS: RegExp[] = [
  /side effect/i,
  /nausea/i,
  /hydration/i,
  /protein/i,
  /missed dose/i,
  /timing/i,
  /book/i,
  /appointment/i,
  /skincare/i,
];

function draftForMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('red')) {
    return 'Some redness can last 2-4 days. If the area is warm, spreading, painful, or you have fever, contact the clinic same day.';
  }
  if (m.includes('nausea')) {
    return 'Mild nausea can happen with GLP-1 treatment. Small protein-forward meals and hydration often help. If symptoms are severe or persistent, contact your provider.';
  }
  if (m.includes('book') || m.includes('appointment')) {
    return 'I can route this to booking. Share your preferred day/time and we will send options.';
  }
  return 'Thanks for flagging this. Here is a draft response aligned with current protocol. Please review before sending.';
}

export function triagePatientMessage(text: string): TriageResult {
  const lower = text.toLowerCase();
  const matched3 = LAYER_3_PATTERNS.filter((p) => p.test(lower)).map((p) => p.source);
  if (matched3.length > 0) {
    return {
      layer: 3,
      confidenceScore: 0.99,
      escalationReason: 'Urgent language detected',
      aiDraft: null,
      urgent: true,
      keywords: matched3,
    };
  }

  const matched2 = LAYER_2_PATTERNS.filter((p) => p.test(lower)).map((p) => p.source);
  if (matched2.length > 0) {
    return {
      layer: 2,
      confidenceScore: 0.74,
      escalationReason: 'Protocol boundary or clinical nuance',
      aiDraft: draftForMessage(text),
      urgent: false,
      keywords: matched2,
    };
  }

  const matched1 = LAYER_1_PATTERNS.filter((p) => p.test(lower)).map((p) => p.source);
  if (matched1.length > 0) {
    return {
      layer: 1,
      confidenceScore: 0.89,
      escalationReason: null,
      aiDraft: draftForMessage(text),
      urgent: false,
      keywords: matched1,
    };
  }

  return {
    layer: 2,
    confidenceScore: 0.62,
    escalationReason: 'Insufficient confidence',
    aiDraft: draftForMessage(text),
    urgent: false,
    keywords: [],
  };
}
