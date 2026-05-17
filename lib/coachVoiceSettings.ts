import AsyncStorage from '@react-native-async-storage/async-storage';

const VOICE_ID_KEY = 'sonalife_coach_elevenlabs_voice_id';
const AUTO_READ_KEY = 'sonalife_coach_auto_read_aloud';

export type CoachVoiceOption = { label: string; id: string };

/** Preset voices (IDs overridable via EXPO_PUBLIC_* in `.env`). */
export function getCoachVoiceOptions(): CoachVoiceOption[] {
  return [
    {
      label: 'Warm Female',
      id: process.env.EXPO_PUBLIC_VOICE_WARM_FEMALE?.trim() || '21m00Tcm4TlvDq8ikWAM',
    },
    {
      label: 'Professional Male',
      id: process.env.EXPO_PUBLIC_VOICE_PROFESSIONAL_MALE?.trim() || 'pNInz6obpgDQGcFmaJgB',
    },
    {
      label: 'Calm Female',
      id: process.env.EXPO_PUBLIC_VOICE_CALM_FEMALE?.trim() || 'EXAVITQu4vr4xnSDxMaL',
    },
    {
      label: 'Energetic Male',
      id: process.env.EXPO_PUBLIC_VOICE_ENERGETIC_MALE?.trim() || 'VR6AewLTigWG4xSOukaG',
    },
  ];
}

export async function getSelectedCoachVoiceId(): Promise<string> {
  const stored = await AsyncStorage.getItem(VOICE_ID_KEY);
  if (stored) return stored;
  const def = process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_ID?.trim();
  if (def) return def;
  return getCoachVoiceOptions()[0]!.id;
}

export async function setSelectedCoachVoiceId(voiceId: string): Promise<void> {
  await AsyncStorage.setItem(VOICE_ID_KEY, voiceId);
}

export async function getCoachAutoReadAloud(): Promise<boolean> {
  const v = await AsyncStorage.getItem(AUTO_READ_KEY);
  return v === '1';
}

export async function setCoachAutoReadAloud(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(AUTO_READ_KEY, enabled ? '1' : '0');
}
