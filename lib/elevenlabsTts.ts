/**
 * TTS: ElevenLabs primary → expo-speech fallback.
 */
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';

import { getExpoPublic } from '@/lib/expoPublicEnv';

let _activeSound: Audio.Sound | null = null;
let _lastStatus: number | null = null;
let _lastError: string | null = null;

export function getLastElevenLabsStatus(): { status: number | null; error: string | null } {
  return { status: _lastStatus, error: _lastError };
}

export async function stopSpeaking(): Promise<void> {
  if (_activeSound) {
    try { await _activeSound.stopAsync(); } catch { /* already stopped */ }
    try { await _activeSound.unloadAsync(); } catch { /* already unloaded */ }
    _activeSound = null;
  }
  try { Speech.stop(); } catch { /* not speaking */ }
}

function stripForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*?/g, '')
    .replace(/#{1,6}\s?/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2500);
}

export async function speakCoachReply(text: string): Promise<{ ok: boolean; reason?: string }> {
  console.log('speakCoachReply called:', text.substring(0, 30));

  await stopSpeaking();

  const textToSpeak = stripForSpeech(text);
  if (!textToSpeak) return { ok: false, reason: 'empty' };

  const apiKey = getExpoPublic('EXPO_PUBLIC_ELEVENLABS_API_KEY');
  const voiceId =
    getExpoPublic('EXPO_PUBLIC_ELEVENLABS_VOICE_ID_FEMALE') ||
    getExpoPublic('EXPO_PUBLIC_ELEVENLABS_VOICE_ID_MALE') ||
    getExpoPublic('EXPO_PUBLIC_ELEVENLABS_VOICE_ID');
  console.log('EL apiKey:', apiKey?.substring(0, 8));
  console.log('EL voiceId:', voiceId);

  try {
    console.log('EL: calling API with voice:', voiceId);
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId ?? ''}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey ?? '',
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: textToSpeak,
          model_id: 'eleven_flash_v2_5',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      },
    );
    console.log('EL: response status:', response.status);
    _lastStatus = response.status;

    if (!response.ok) {
      const err = await response.text();
      console.error('EL: API error body (full):', err);
      _lastError = err;
      Speech.speak(textToSpeak);
      return { ok: false, reason: 'api_error' };
    }
    _lastError = null;

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // FileSystem.EncodingType.Base64 is undefined in some production builds —
    // use the string literal directly. Same for the chunked binary build.
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      const chunk = bytes.subarray(i, i + 8192);
      binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    const base64Audio = btoa(binary);

    const fileUri = FileSystem.cacheDirectory + `sona_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
      encoding: 'base64' as never,
    });

    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      allowsRecordingIOS: false,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri: fileUri },
      { shouldPlay: true, volume: 1.0, progressUpdateIntervalMillis: 500 },
    );
    _activeSound = sound;

    return new Promise((resolve) => {
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          void sound.unloadAsync().catch(() => {});
          void FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
          _activeSound = null;
          resolve({ ok: true });
        }
      });
      setTimeout(() => {
        void sound.unloadAsync().catch(() => {});
        _activeSound = null;
        resolve({ ok: true });
      }, 120_000);
    });
  } catch (e) {
    const msg = String((e as Error)?.stack ?? (e as Error)?.message ?? e);
    console.warn('[TTS] error (full):', msg);
    _lastError = msg;
    _lastStatus = -1;
    Speech.speak(textToSpeak);
    return { ok: false, reason: 'error' };
  }
}
