import { CLAUDE_MODEL } from '@/lib/aiModel';
import { supabase } from '@/lib/supabase';

export const CLINICAL_SPECIALTIES = [
  'GLP-1 & Weight Loss',
  'HRT & Hormones',
  'Body Composition',
  'Supplements & Nutraceuticals',
  'Peptides',
  'Longevity & Aging',
  'Aesthetics & Skin',
  'General Internal Medicine',
] as const;

export type ClinicalConfidence =
  | 'Strong Evidence'
  | 'Moderate Evidence'
  | 'Emerging Evidence'
  | 'Conflicting Evidence'
  | 'Expert Opinion Only';

export type StudyCitation = {
  title: string;
  authors: string;
  journal: string;
  year: string;
  finding: string;
  pubmed_url: string;
  doi?: string;
};

export type ClinicalInsightResponse = {
  clinical_answer: string;
  confidence_level: ClinicalConfidence;
  key_findings: string[];
  clinical_application: string;
  specialty_note: string;
  disclaimer: string;
  studies: StudyCitation[];
  evidence_flags: string[];
  simplified_patient_version: string;
};

export type PatientClinicalContext = {
  patientId: string;
  age: number | null;
  sex: string | null;
  goals: string[];
  glp1Dose: string | null;
  latestLabs: string[];
  latestInbody: string[];
};

export type ClinicalEngineContextLevel = 'provider_research' | 'admin_aggregate' | 'patient_coach';

type ClinicalEngineParams = {
  providerId: string;
  clinicId: string | null;
  queryText: string;
  specialties: string[];
  contextLevel: ClinicalEngineContextLevel;
  patientContext?: PatientClinicalContext | null;
  aggregateContext?: string | null;
  persistResult?: boolean;
};

function defaultResponse(): ClinicalInsightResponse {
  return {
    clinical_answer:
      'Unable to produce a verified synthesis at this time. Please retry with a narrower question.',
    confidence_level: 'Expert Opinion Only',
    key_findings: ['No validated synthesis returned.'],
    clinical_application:
      'Use standard of care and direct source verification before applying to patient care.',
    specialty_note: '',
    disclaimer: 'This is a research synthesis tool. Clinical decisions require provider judgment.',
    studies: [],
    evidence_flags: ['No verified citations returned'],
    simplified_patient_version:
      'I could not verify enough evidence right now. Please ask your provider to review this directly.',
  };
}

function getAnthropicKey(): string | null {
  const key = (process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '').trim();
  if (!key || !key.startsWith('sk-ant-')) return null;
  return key;
}

export async function fetchPatientClinicalContext(patientId: string): Promise<PatientClinicalContext | null> {
  const [{ data: patient }, { data: goals }, { data: glp1 }, { data: labs }, { data: inbody }] =
    await Promise.all([
      supabase
        .from('patients')
        .select('id, age, sex')
        .eq('id', patientId)
        .maybeSingle(),
      supabase
        .from('patient_goals')
        .select('primary_goal, goal_description')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('glp1_records')
        .select('medication_name, dose_amount, injection_date')
        .eq('patient_id', patientId)
        .order('injection_date', { ascending: false })
        .limit(1),
      supabase
        .from('lab_results')
        .select('lab_name, result_value, result_units, measured_at')
        .eq('patient_id', patientId)
        .order('measured_at', { ascending: false })
        .limit(6),
      supabase
        .from('inbody_entries')
        .select('weight_lbs, body_fat_pct, skeletal_muscle_lbs, measured_at')
        .eq('patient_id', patientId)
        .order('measured_at', { ascending: false })
        .limit(1),
    ]);
  if (!patient?.id) return null;
  const lastGlp1 = glp1?.[0];
  const goalsArr = (goals ?? [])
    .flatMap((g) => [g.primary_goal, g.goal_description])
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  const latestLabs = (labs ?? []).map(
    (x) =>
      `${x.lab_name ?? 'Lab'}: ${x.result_value ?? '—'}${x.result_units ? ` ${x.result_units}` : ''} (${String(x.measured_at ?? '').slice(0, 10)})`,
  );
  const latestInbody = (inbody ?? []).map(
    (x) =>
      `InBody ${String(x.measured_at ?? '').slice(0, 10)}: wt ${x.weight_lbs ?? '—'} lb, BF ${x.body_fat_pct ?? '—'}%, SMM ${x.skeletal_muscle_lbs ?? '—'} lb`,
  );
  return {
    patientId: patient.id,
    age: patient.age != null ? Number(patient.age) : null,
    sex: patient.sex != null ? String(patient.sex) : null,
    goals: goalsArr,
    glp1Dose: lastGlp1
      ? `${lastGlp1.medication_name ?? 'GLP-1'} ${lastGlp1.dose_amount ?? ''} (${lastGlp1.injection_date ?? ''})`.trim()
      : null,
    latestLabs,
    latestInbody,
  };
}

function parseJsonLoose(raw: string): ClinicalInsightResponse {
  try {
    const parsed = JSON.parse(raw) as Partial<ClinicalInsightResponse>;
    return {
      ...defaultResponse(),
      ...parsed,
      key_findings: Array.isArray(parsed.key_findings) ? parsed.key_findings.map(String) : [],
      studies: Array.isArray(parsed.studies)
        ? parsed.studies.map((s) => ({
            title: String((s as StudyCitation).title ?? ''),
            authors: String((s as StudyCitation).authors ?? ''),
            journal: String((s as StudyCitation).journal ?? ''),
            year: String((s as StudyCitation).year ?? ''),
            finding: String((s as StudyCitation).finding ?? ''),
            pubmed_url: String((s as StudyCitation).pubmed_url ?? ''),
            doi: (s as StudyCitation).doi ? String((s as StudyCitation).doi) : undefined,
          }))
        : [],
      evidence_flags: Array.isArray(parsed.evidence_flags) ? parsed.evidence_flags.map(String) : [],
    };
  } catch {
    return defaultResponse();
  }
}

export async function runClinicalInsightsQuery(params: {
  providerId: string;
  clinicId: string | null;
  patientContext: PatientClinicalContext | null;
  queryText: string;
  specialties: string[];
}): Promise<{ response: ClinicalInsightResponse; error: string | null }> {
  return runClinicalEngineQuery({
    providerId: params.providerId,
    clinicId: params.clinicId,
    queryText: params.queryText,
    specialties: params.specialties,
    contextLevel: 'provider_research',
    patientContext: null,
    persistResult: true,
  });
}

function contextBlockForEngine(params: ClinicalEngineParams): string {
  if (params.contextLevel === 'provider_research') {
    return 'Context level: provider clinical research. Do not use or infer individual patient data.';
  }
  if (params.contextLevel === 'admin_aggregate') {
    return `Context level: admin aggregate operations. Use only aggregate context and never infer patient identity. Aggregate context: ${params.aggregateContext?.trim() || 'none provided'}.`;
  }
  const p = params.patientContext;
  if (!p) {
    return 'Context level: patient coach clinical question. No patient dataset attached; answer generally and ask for clinician follow-up where needed.';
  }
  return `Context level: patient coach clinical question with patient data. Patient context: age ${p.age ?? 'unknown'}, sex ${p.sex ?? 'unknown'}, goals ${p.goals.join('; ') || 'not provided'}, GLP-1 ${p.glp1Dose ?? 'none on file'}, labs ${p.latestLabs.join(' | ') || 'none'}, InBody ${p.latestInbody.join(' | ') || 'none'}.`;
}

export async function runClinicalEngineQuery(
  params: ClinicalEngineParams,
): Promise<{ response: ClinicalInsightResponse; error: string | null }> {
  const key = getAnthropicKey();
  if (!key) return { response: defaultResponse(), error: 'Anthropic API key missing.' };

  const specialtyText = params.specialties.length ? params.specialties.join(', ') : 'General Internal Medicine';
  const contextBlock = contextBlockForEngine(params);
  const system = `You are Kenovus Clinical Insights, an evidence-based clinical research synthesizer for licensed providers.
Rules:
- Use web_search to find PubMed and peer-reviewed literature where possible.
- Prioritize 2021-2026 studies; if older studies dominate, explicitly say so.
- Never fabricate citations. If uncertain, mark unverified.
- Flag weak/conflicting evidence, animal-only evidence, and small-n limitations.
- Output strict JSON only with keys:
clinical_answer, confidence_level, key_findings, clinical_application, specialty_note, disclaimer, studies, evidence_flags, simplified_patient_version.
- confidence_level must be one of: Strong Evidence, Moderate Evidence, Emerging Evidence, Conflicting Evidence, Expert Opinion Only.
- studies is an array with: title, authors, journal, year, finding, pubmed_url, doi(optional).
- disclaimer must be exactly: "This is a research synthesis tool. Clinical decisions require provider judgment."`;
  const user = `Question: ${params.queryText}
Specialty focus: ${specialtyText}
${contextBlock}
Include med-spa / GLP-1 / wellness clinical practicality where relevant.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'web-search-2025-03-05',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1800,
      system,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6 }],
      tool_choice: { type: 'auto' },
      messages: [{ role: 'user', content: [{ type: 'text', text: user }] }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { response: defaultResponse(), error: `Anthropic request failed: ${res.status} ${t.slice(0, 200)}` };
  }
  const json = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = json.content?.find((c) => c.type === 'text')?.text?.trim() ?? '';
  const parsed = parseJsonLoose(text);

  if (params.persistResult !== false) {
    const { error: dbErr } = await supabase.from('clinical_queries').insert({
      provider_id: params.providerId,
      clinic_id: params.clinicId,
      patient_id: params.contextLevel === 'patient_coach' ? params.patientContext?.patientId ?? null : null,
      query_text: params.queryText,
      specialty_filter: params.specialties,
      response_json: parsed,
    });
    if (dbErr) {
      console.warn('[clinical_queries] insert failed', dbErr.message);
    }
  }
  return { response: parsed, error: null };
}

export async function runProviderClinicalResearchQuery(params: {
  providerId: string;
  clinicId: string | null;
  queryText: string;
  specialties: string[];
}) {
  return runClinicalEngineQuery({ ...params, contextLevel: 'provider_research', patientContext: null, persistResult: true });
}

export async function runAdminAskSonaClinicalQuery(params: {
  providerId: string;
  clinicId: string | null;
  queryText: string;
  specialties?: string[];
  aggregateContext?: string | null;
}) {
  return runClinicalEngineQuery({
    providerId: params.providerId,
    clinicId: params.clinicId,
    queryText: params.queryText,
    specialties: params.specialties ?? ['General Internal Medicine'],
    contextLevel: 'admin_aggregate',
    aggregateContext: params.aggregateContext ?? null,
    persistResult: false,
  });
}

export async function runPatientCoachClinicalQuery(params: {
  providerId: string;
  clinicId: string | null;
  queryText: string;
  specialties?: string[];
  patientContext: PatientClinicalContext | null;
}) {
  return runClinicalEngineQuery({
    providerId: params.providerId,
    clinicId: params.clinicId,
    queryText: params.queryText,
    specialties: params.specialties ?? ['General Internal Medicine'],
    contextLevel: 'patient_coach',
    patientContext: params.patientContext,
    persistResult: false,
  });
}

export async function fetchRecentClinicalQueries(providerId: string): Promise<
  Array<{ id: string; query_text: string; created_at: string; response_json: ClinicalInsightResponse }>
> {
  const { data } = await supabase
    .from('clinical_queries')
    .select('id, query_text, created_at, response_json')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false })
    .limit(10);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    query_text: String(r.query_text),
    created_at: String(r.created_at),
    response_json: (r.response_json as ClinicalInsightResponse) ?? defaultResponse(),
  }));
}

export async function saveStudyToClinicLibrary(params: {
  clinicId: string;
  providerId: string;
  queryId?: string | null;
  study: StudyCitation;
}): Promise<string | null> {
  const { data, error } = await supabase
    .from('clinic_supplement_library')
    .insert({
      clinic_id: params.clinicId,
      provider_id: params.providerId,
      query_id: params.queryId ?? null,
      study_title: params.study.title,
      citation_text: `${params.study.authors}. ${params.study.journal}. ${params.study.year}.`,
      pubmed_url: params.study.pubmed_url,
      doi: params.study.doi ?? null,
      summary: params.study.finding,
    })
    .select('id')
    .maybeSingle();
  if (error) return error.message;
  return null;
}
