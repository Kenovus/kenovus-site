/**
 * TTS: ElevenLabs primary → expo-speech fallback.
 * FORCE_TEST_MODE logs all credential values for debugging — set false once confirmed working.
 */
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';

import { getExpoPublic } from '@/lib/expoPublicEnv';

// Debug status reporter — set by sona.tsx debug panel, no-op otherwise
function reportTts(status: 'success' | 'failed' | 'not attempted') {
  try {
    // Lazy import to avoid circular dependency
    const mod = require('@/app/patient/sona') as { _setTtsDebugStatus?: ((s: typeof status) => void) | null };
    mod._setTtsDebugStatus?.(status);
  } catch { /* panel not mounted */ }
}

const FORCE_TEST_MODE = true; // remove after confirming it works

let _activeSound: Audio.Sound | null = null;

export async function stopSpeaking(): Promise<void> {
  if (_activeSound) {
    try { await _activeSound.stopAsync(); } catch { /* already stopped */ }
    try { await _activeSound.unloadAsync(); } catch { /* already unloaded */ }
    _activeSound = null;
  }
  try { Speech.stop(); } catch { /* not speaking */ }
  console.log('[TTS] stopped');
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
  console.log('[TTS] falling back to expo-speech');
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
  await stopSpeaking();

  const textToSpeak = stripForSpeech(text);
  if (!textToSpeak) return { ok: false, reason: 'empty' };

  // Resolve credentials
  const apiKey = getExpoPublic('EXPO_PUBLIC_ELEVENLABS_API_KEY');
  const voiceId =
    getExpoPublic('EXPO_PUBLIC_ELEVENLABS_VOICE_ID_FEMALE') ||
    getExpoPublic('EXPO_PUBLIC_ELEVENLABS_VOICE_ID_MALE') ||
    getExpoPublic('EXPO_PUBLIC_ELEVENLABS_VOICE_ID') ||
    null;

  if (FORCE_TEST_MODE) {
    console.log('=== ELEVENLABS DEBUG ===');
    console.log('API KEY (process.env):', process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY?.substring(0, 8));
    console.log('KEY VIA getExpoPublic:', getExpoPublic('EXPO_PUBLIC_ELEVENLABS_API_KEY')?.substring(0, 8));
    console.log('VOICE ID FEMALE:', getExpoPublic('EXPO_PUBLIC_ELEVENLABS_VOICE_ID_FEMALE'));
    console.log('VOICE ID MALE:', getExpoPublic('EXPO_PUBLIC_ELEVENLABS_VOICE_ID_MALE'));
    console.log('VOICE ID:', getExpoPublic('EXPO_PUBLIC_ELEVENLABS_VOICE_ID'));
    console.log('========================');
  }

  if (!apiKey) {
    console.error('ELEVENLABS: No API key found');
    await speakWithExpoSpeech(textToSpeak);
    return { ok: true, reason: 'expo_speech_fallback' };
  }

  if (!voiceId) {
    console.error('ELEVENLABS: No voice ID found in any env var');
    await speakWithExpoSpeech(textToSpeak);
    return { ok: true, reason: 'expo_speech_fallback' };
  }

  try {
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
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      },
    );

    console.log('ElevenLabs status:', response.status);
    console.log('ElevenLabs response ok:', response.ok);

    if (!response.ok) {
      const err = await response.text();
      console.error('ElevenLabs error:', err);
      reportTts('failed');
      await speakWithExpoSpeech(textToSpeak);
      return { ok: true, reason: 'expo_speech_fallback' };
    }

    // Decode audio to base64
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (bytes.byteLength < 100) {
      console.warn('[TTS] tiny audio buffer — expo-speech fallback');
      await speakWithExpoSpeech(textToSpeak);
      return { ok: true, reason: 'expo_speech_fallback' };
    }

    // Chunked base64 encoding to avoid blocking the JS thread
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);

    const fileUri = (FileSystem.cacheDirectory ?? '') + `sona_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      allowsRecordingIOS: false,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri: fileUri },
      { shouldPlay: true, volume: 1.0 },
    );
    _activeSound = sound;

    reportTts('success');
    return new Promise((resolve) => {
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          void sound.unloadAsync().catch(() => {});
          void FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
          _activeSound = null;
          resolve({ ok: true });
        }
      });
      // Safety timeout: resolve after 60s regardless
      setTimeout(() => {
        void sound.unloadAsync().catch(() => {});
        _activeSound = null;
        resolve({ ok: true });
      }, 60_000);
    });
  } catch (e) {
    console.warn('[TTS] error:', e);
    reportTts('failed');
    await speakWithExpoSpeech(textToSpeak);
    return { ok: true, reason: 'expo_speech_fallback' };
  }
}
