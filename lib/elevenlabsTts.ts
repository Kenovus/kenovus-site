/**
 * TTS: ElevenLabs primary → expo-speech fallback.
 */
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';

import { getExpoPublic } from '@/lib/expoPublicEnv';

let _activeSound: Audio.Sound | null = null;

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

async function speakWithExpoSpeech(text: string): Promise<void> {
  const available = await Speech.getAvailableVoicesAsync().catch(() => []);
  const preferred = available.find(
    (v) => v.language?.startsWith('en') && (
      v.name?.toLowerCase().includes('samantha') ||
      v.name?.toLowerCase().includes('karen') ||
      v.name?.toLowerCase().includes('female')
    ),
  );
  await new Promise<void>((resolve) => {
    Speech.speak(text, {
      language: 'en-US',
      voice: preferred?.identifier,
      rate: 0.92,
      pitch: 1.0,
      onDone: resolve,
      onError: (e) => { console.warn('[TTS] expo-speech error:', e); resolve(); },
    });
  });
}

export async function speakCoachReply(text: string): Promise<{ ok: boolean; reason?: string }> {
  const apiKey = getExpoPublic('EXPO_PUBLIC_ELEVENLABS_API_KEY');
  const voiceId =
    getExpoPublic('EXPO_PUBLIC_ELEVENLABS_VOICE_ID_FEMALE') ||
    getExpoPublic('EXPO_PUBLIC_ELEVENLABS_VOICE_ID_MALE') ||
    getExpoPublic('EXPO_PUBLIC_ELEVENLABS_VOICE_ID');
  console.log('EL apiKey:', apiKey?.substring(0, 8));
  console.log('EL voiceId:', voiceId);
  if (!apiKey || !voiceId) {
    console.error('EL: missing credentials, using fallback');
    Speech.speak(text);
    return { ok: false, reason: 'missing_credentials' };
  }

  await stopSpeaking();

  const textToSpeak = stripForSpeech(text);
  if (!textToSpeak) return { ok: false, reason: 'empty' };

  try {
    console.log('EL: calling API with voice:', voiceId);
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
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

    if (!response.ok) {
      const err = await response.text();
      console.error('EL: API error:', err);
      Speech.speak(textToSpeak);
      return { ok: false, reason: 'api_error' };
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (bytes.byteLength < 100) {
      await speakWithExpoSpeech(textToSpeak);
      return { ok: true, reason: 'expo_speech_fallback' };
    }

    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += 8192) {
      chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
    }
    const base64Audio = btoa(chunks.join(''));

    const fileUri = (FileSystem.cacheDirectory ?? '') + `sona_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
      encoding: FileSystem.EncodingType.Base64,
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
    console.warn('[TTS] error:', e);
    await speakWithExpoSpeech(textToSpeak);
    return { ok: true, reason: 'expo_speech_fallback' };
  }
}
