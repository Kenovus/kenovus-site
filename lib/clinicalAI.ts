/**
 * PART 4 — Clinical AI query handler.
 * Routes clinical questions through Simi's protocols with full patient personalization.
 */
import { anthropicMessages } from '@/lib/anthropic';
import { SIMI_PROTOCOLS } from '@/lib/simiClinicalProtocols';
import { type PatientFullContext, formatPatientContextBlock } from '@/lib/patientContext';

export type ClinicalCategory =
  | 'nutrition'
  | 'glp1'
  | 'supplements'
  | 'aesthetics'
  | 'bodybuilding'
  | 'general_health'
  | 'labs'
  | 'skincare';

const CLINICAL_KEYWORDS: Record<ClinicalCategory, string[]> = {
  nutrition: ['calorie','protein','carb','fat','macro','meal','diet','eat','food','weight loss'],
  glp1: ['semaglutide','ozempic','wegovy','tirzepatide','mounjaro','glp','injection','dose','nausea','vomiting'],
  supplements: ['creatine','supplement','vitamin','mineral','collagen','omega','probiotic','hmb','magnesium'],
  aesthetics: ['botox','filler','laser','ipl','microneedling','sculptra','radiesse','treatment','daxxify'],
  bodybuilding: ['muscle','bulk','cut','recomp','progressive overload','pr','bench','squat','deadlift','hypertrophy','periodization'],
  general_health: ['sleep','hrv','heart rate','recovery','stress','energy','fatigue','inflammation'],
  labs: ['lab','blood','a1c','cholesterol','hba1c','cmp','cbc','lipid','thyroid','testosterone'],
  skincare: ['skin','pore','wrinkle','pigment','moisturizer','retinol','spf','sunscreen','serum'],
};

export function classifyQuestion(text: string): ClinicalCategory {
  const lower = text.toLowerCase();
  let bestCategory: ClinicalCategory = 'general_health';
  let bestScore = 0;

  for (const [cat, keywords] of Object.entries(CLINICAL_KEYWORDS) as [ClinicalCategory, string[]][]) {
    const score = keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) { bestScore = score; bestCategory = cat; }
  }
  return bestCategory;
}

export function isClinicalQuestion(text: string): boolean {
  const lower = text.toLowerCase();
  const allKeywords = Object.values(CLINICAL_KEYWORDS).flat();
  return allKeywords.filter((kw) => lower.includes(kw)).length >= 2;
}

function getProtocolBlock(category: ClinicalCategory): string {
  switch (category) {
    case 'glp1':
      return `GLP-1 Protocols:\n${JSON.stringify(SIMI_PROTOCOLS.glp1, null, 2)}`;
    case 'supplements':
      return `Supplement Protocols:\n${JSON.stringify(SIMI_PROTOCOLS.supplements, null, 2)}`;
    case 'aesthetics':
      return `Post-Care Protocols:\n${JSON.stringify(SIMI_PROTOCOLS.postCareProtocols, null, 2)}`;
    case 'skincare':
      return `Skin Assessment:\n${JSON.stringify(SIMI_PROTOCOLS.skinAssessment, null, 2)}`;
    default:
      return `Escalation Triggers: ${SIMI_PROTOCOLS.provider.escalationTriggers.join(', ')}`;
  }
}

export async function clinicalQueryHandler(opts: {
  question: string;
  patientCtx: PatientFullContext | null;
  conversationHistory?: string;
}): Promise<string> {
  const { question, patientCtx, conversationHistory = '' } = opts;
  const category = classifyQuestion(question);
  const protocolBlock = getProtocolBlock(category);
  const ctxBlock = patientCtx ? formatPatientContextBlock(patientCtx) : '';

  const system = `You are Sona, the clinical AI coach for Sona Medical Aesthetics, trained by Simi Kennedy CRNA ARNP.

CLINICAL CATEGORY: ${category.toUpperCase()}

SIMI'S CLINICAL PROTOCOLS (authoritative — follow these exactly):
${protocolBlock}

${ctxBlock ? `PATIENT DATA:\n${ctxBlock}` : ''}

RESPONSE STRUCTURE:
1. Answer the clinical question clearly and specifically (2-3 paragraphs).
2. Cite which protocol or evidence you're drawing from.
3. Then write exactly this header: "Here's how this applies to you specifically:"
4. Personalize the answer using their exact data (name, weight, protein intake, GLP-1 dose, muscle mass, recent workouts, etc.).
5. Give 1-3 concrete, specific action steps they can take TODAY.
6. End with: "This is educational information. Always discuss clinical decisions with Simi or your provider."

Be as specific as a world-class coach who has access to all their data. Never be generic.`;

  const user = conversationHistory
    ? `${conversationHistory}\nuser: ${question}`
    : question;

  const { text, error } = await anthropicMessages({ system, user, maxTokens: 600 });

  if (error || !text) {
    return `Based on Simi's protocols for ${category}: ${question}\n\nI'd recommend discussing this specifically with Simi at your next visit. This is educational information — always discuss clinical decisions with your provider.`;
  }
  return text;
}
