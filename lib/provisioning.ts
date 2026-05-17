import { supabase } from '@/lib/supabase';

type ClinicInput = {
  name: string;
  slug: string;
  app_name: string;
  email?: string | null;
  phone?: string | null;
};

type ProviderInput = {
  clinic_id: string;
  auth_user_id: string;
  first_name: string;
  last_name: string;
  title?: string | null;
  email: string;
  phone?: string | null;
  is_owner?: boolean;
};

type PatientInput = {
  clinic_id: string;
  provider_id?: string | null;
  auth_user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  sex?: 'male' | 'female' | 'other' | 'prefer_not' | null;
};

type UserProfileInput = {
  auth_user_id: string;
  clinic_id: string;
  role: 'clinic_owner' | 'provider' | 'clinic_patient';
  secondary_role?: 'clinic_patient' | null;
  full_name: string;
  email: string;
};

export async function createClinic(input: ClinicInput): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('clinics')
    .insert({
      name: input.name,
      slug: input.slug,
      app_name: input.app_name,
      email: input.email ?? null,
      phone: input.phone ?? null,
    })
    .select('id')
    .single();

  return { id: data?.id ?? null, error: error?.message ?? null };
}

export async function createProvider(
  input: ProviderInput,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('providers')
    .insert({
      clinic_id: input.clinic_id,
      auth_user_id: input.auth_user_id,
      first_name: input.first_name,
      last_name: input.last_name,
      title: input.title ?? null,
      email: input.email,
      phone: input.phone ?? null,
      is_owner: input.is_owner ?? false,
    })
    .select('id')
    .single();

  return { id: data?.id ?? null, error: error?.message ?? null };
}

export async function createPatient(input: PatientInput): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('patients')
    .insert({
      clinic_id: input.clinic_id,
      provider_id: input.provider_id ?? null,
      auth_user_id: input.auth_user_id,
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email,
      phone: input.phone ?? null,
      sex: input.sex ?? null,
    })
    .select('id')
    .single();

  return { id: data?.id ?? null, error: error?.message ?? null };
}

export async function upsertUserProfile(input: UserProfileInput): Promise<{ error: string | null }> {
  const { error } = await supabase.from('user_profiles').upsert(
    {
      auth_user_id: input.auth_user_id,
      clinic_id: input.clinic_id,
      role: input.role,
      secondary_role: input.secondary_role ?? null,
      full_name: input.full_name,
      email: input.email,
    },
    { onConflict: 'auth_user_id' },
  );
  return { error: error?.message ?? null };
}

export async function createAuthUserViaEdge(input: {
  email: string;
  password: string;
  role: 'provider' | 'clinic_patient';
  fullName: string;
}): Promise<{ id: string | null; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('admin-create-auth-user', {
      body: {
        email: input.email,
        password: input.password,
        role: input.role,
        full_name: input.fullName,
      },
    });
    if (error) return { id: null, error: error.message };
    const id = (data as { user_id?: string })?.user_id ?? null;
    if (!id) return { id: null, error: 'Edge function returned no user_id' };
    return { id, error: null };
  } catch (e) {
    return { id: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function seedStarterVitality(patientId: string): Promise<{ error: string | null }> {
  const today = new Date().toISOString().slice(0, 10);
  const body = 78;
  const health = 76;
  const mindset = 74;
  const momentum = 80;
  const aesthetics = 73;
  const identity = 77;
  const total = Math.round(
    body * 0.22 +
      health * 0.22 +
      mindset * 0.18 +
      momentum * 0.18 +
      aesthetics * 0.1 +
      identity * 0.1,
  );
  const { error } = await supabase.from('vitality_scores').upsert(
    {
      patient_id: patientId,
      score_date: today,
      body_score: body,
      health_score: health,
      mindset_score: mindset,
      momentum_score: momentum,
      aesthetics_score: aesthetics,
      identity_score: identity,
      total_score: total,
      sleep_hours: 7.0,
      mood_rating: 4,
      energy_rating: 4,
      notes: 'Starter seed',
    },
    { onConflict: 'patient_id,score_date' },
  );
  return { error: error?.message ?? null };
}

export async function seedStarterCoachThread(input: {
  patientId: string;
  clinicId: string;
}): Promise<{ error: string | null }> {
  const { data: conversation, error: cErr } = await supabase
    .from('ai_conversations')
    .insert({
      patient_id: input.patientId,
      clinic_id: input.clinicId,
      title: 'Welcome to SonaLife',
    })
    .select('id')
    .single();
  if (cErr) return { error: cErr.message };

  const { error: mErr } = await supabase.from('ai_messages').insert([
    {
      conversation_id: conversation.id,
      role: 'assistant',
      content:
        "Welcome to SonaLife. I am your coach. We'll keep this simple and focused on what moves your number.",
    },
    {
      conversation_id: conversation.id,
      role: 'assistant',
      content: 'Start with one action today: hydration, protein, and a short walk.',
    },
  ]);
  if (mErr) return { error: mErr.message };
  return { error: null };
}

export async function seedStarterProviderMessage(input: {
  patientId: string;
  clinicId: string;
}): Promise<{ error: string | null }> {
  const { data: inserted, error } = await supabase
    .from('patient_messages')
    .insert({
      patient_id: input.patientId,
      clinic_id: input.clinicId,
      message_text: 'Is it normal that my injection site is still red after 3 days?',
      message_source: 'patient',
      triage_layer: 2,
      ai_draft:
        'Some redness can last 2-4 days. If warm, spreading, painful, or with fever, contact the clinic today.',
      escalation_reason: 'Protocol boundary or clinical nuance',
      is_urgent: false,
    })
    .select('id')
    .single();
  if (error) return { error: error.message };

  const { error: logErr } = await supabase.from('message_triage_log').insert({
    message_id: inserted.id,
    confidence_score: 0.74,
    escalation_reason: 'Protocol boundary or clinical nuance',
    layer_assigned: 2,
    keywords_matched: ['red after 3 days'],
  });
  if (logErr) return { error: logErr.message };
  return { error: null };
}
