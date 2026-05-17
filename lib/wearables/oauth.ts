import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { supabase } from '@/lib/supabase';
import type { WearableConnection, WearableProvider } from '@/lib/wearables/types';

const PROVIDER_META: Record<
  Exclude<WearableProvider, 'apple_health'>,
  { authBase: string; scopes: string[]; clientIdEnv: string }
> = {
  oura: {
    authBase: 'https://cloud.ouraring.com/oauth/authorize',
    scopes: ['personal', 'daily', 'heartrate', 'session', 'workout', 'spo2', 'tag', 'sleep'],
    clientIdEnv: 'EXPO_PUBLIC_OURA_CLIENT_ID',
  },
  whoop: {
    authBase: 'https://api.prod.whoop.com/oauth/oauth2/auth',
    scopes: ['read:recovery', 'read:cycles', 'read:workout', 'read:profile', 'offline'],
    clientIdEnv: 'EXPO_PUBLIC_WHOOP_CLIENT_ID',
  },
  fitbit: {
    authBase: 'https://www.fitbit.com/oauth2/authorize',
    scopes: ['activity', 'sleep', 'heartrate', 'weight', 'profile'],
    clientIdEnv: 'EXPO_PUBLIC_FITBIT_CLIENT_ID',
  },
};

function parseConnection(row: Record<string, unknown>): WearableConnection {
  return {
    id: String(row.id),
    provider: row.provider as WearableProvider,
    status: row.status as WearableConnection['status'],
    external_user_id: (row.external_user_id as string | null) ?? null,
    scopes: Array.isArray(row.scopes) ? row.scopes.map((x) => String(x)) : [],
    last_sync_at: (row.last_sync_at as string | null) ?? null,
    last_error: (row.last_error as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

function randomState(): string {
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function getProviderClientId(provider: Exclude<WearableProvider, 'apple_health'>): string {
  const envName = PROVIDER_META[provider].clientIdEnv;
  const value = (process.env[envName] ?? '').trim();
  if (!value) throw new Error(`${envName} is missing. Add it in .env and restart Metro.`);
  return value;
}

function buildAuthUrl(provider: Exclude<WearableProvider, 'apple_health'>, redirectUri: string, state: string): string {
  const meta = PROVIDER_META[provider];
  const clientId = getProviderClientId(provider);
  const url = new URL(meta.authBase);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', meta.scopes.join(provider === 'fitbit' ? ' ' : ','));
  url.searchParams.set('state', state);
  if (provider === 'fitbit') {
    url.searchParams.set('expires_in', '604800');
  }
  return url.toString();
}

async function getPatientId(authUserId: string): Promise<string> {
  const patientId = await fetchPatientIdForAuthUser(authUserId);
  if (!patientId) throw new Error('Patient profile missing.');
  return patientId;
}

export async function listWearableConnectionsForAuthUser(
  authUserId: string,
): Promise<{ rows: WearableConnection[]; error: Error | null }> {
  try {
    const patientId = await getPatientId(authUserId);
    const { data, error } = await supabase
      .from('wearable_connections')
      .select('id, provider, status, external_user_id, scopes, last_sync_at, last_error, metadata')
      .eq('patient_id', patientId)
      .order('provider', { ascending: true });
    if (error) return { rows: [], error: new Error(error.message) };
    return { rows: (data ?? []).map((row) => parseConnection(row as Record<string, unknown>)), error: null };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err : new Error('Unable to load wearable connections') };
  }
}

export async function disconnectWearableForAuthUser(
  authUserId: string,
  provider: Exclude<WearableProvider, 'apple_health'>,
): Promise<{ ok: boolean; error: Error | null }> {
  try {
    const patientId = await getPatientId(authUserId);
    const { error } = await supabase.from('wearable_connections').upsert(
      {
        patient_id: patientId,
        provider,
        status: 'disconnected',
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'patient_id,provider' },
    );
    return { ok: !error, error: error ? new Error(error.message) : null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err : new Error('Unable to disconnect provider') };
  }
}

export async function startWearableOAuthForAuthUser(input: {
  authUserId: string;
  provider: Exclude<WearableProvider, 'apple_health'>;
}): Promise<{ code: string | null; state: string | null; redirectUri: string; error: Error | null }> {
  const redirectUri = Linking.createURL('/patient/profile/wearables');
  try {
    await WebBrowser.warmUpAsync();
    const state = randomState();
    const authUrl = buildAuthUrl(input.provider, redirectUri, state);
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
    if (result.type !== 'success' || !result.url) {
      return { code: null, state: null, redirectUri, error: new Error('Authorization canceled or failed.') };
    }
    const parsed = Linking.parse(result.url);
    const resultCode = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : null;
    const resultState = typeof parsed.queryParams?.state === 'string' ? parsed.queryParams.state : null;
    if (!resultCode) return { code: null, state: resultState, redirectUri, error: new Error('Missing OAuth code.') };
    if (resultState !== state) return { code: null, state: resultState, redirectUri, error: new Error('Invalid OAuth state.') };

    const patientId = await getPatientId(input.authUserId);
    const { error } = await supabase.from('wearable_connections').upsert(
      {
        patient_id: patientId,
        provider: input.provider,
        status: 'pending',
        scopes: PROVIDER_META[input.provider].scopes,
        last_error: null,
        metadata: { oauth_redirect_uri: redirectUri, linked_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'patient_id,provider' },
    );
    if (error) return { code: null, state: resultState, redirectUri, error: new Error(error.message) };
    return { code: resultCode, state: resultState, redirectUri, error: null };
  } catch (err) {
    return {
      code: null,
      state: null,
      redirectUri,
      error: err instanceof Error ? err : new Error('Unable to start wearable OAuth'),
    };
  } finally {
    void WebBrowser.coolDownAsync();
  }
}
