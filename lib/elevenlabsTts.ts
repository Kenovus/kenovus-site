/**
 * TTS: ElevenLabs primary → expo-speech fallback (no API key needed).
 * Exports stopSpeaking() so the UI can interrupt at any time.
 */
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';

import { getExpoPublic } from '@/lib/expoPublicEnv';

const MODEL_ID = 'eleven_flash_v2_5';

let _activeSound: Audio.Sound | null = null;
let _isSpeechActive = false;

export async function stopSpeaking(): Promise<void> {
  _isSpeechActive = false;
  if (_activeSound) {
    try { await _activeSound.stopAsync(); } catch { /* already stopped */ }
    try { await _activeSound.unloadAsync(); } catch { /* already unloaded */ }
    _activeSound = null;
  }
  try { Speech.stop(); } catch { /* not speaking */ }
  console.log('[TTS] stopped by user');
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

function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK = 512;
  const parts: string[] = [];
  for (let i = 0; i < bytes.byteLength; i += CHUNK) {
    const slice = Array.from(bytes.subarray(i, i + CHUNK));
    parts.push(String.fromCharCode(...slice));
  }
  return globalThis.btoa(parts.join(''));
}

async function speakWithExpoSpeech(text: string): Promise<void> {
  if (!_isSpeechActive) return;
  console.log('[TTS] expo-speech fallback');
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

  const plain = stripForSpeech(text);
  if (!plain) return { ok: false, reason: 'empty' };
  _isSpeechActive = true;

  // Resolve credentials — check all env var variants
  const apiKey = getExpoPublic('EXPO_PUBLIC_ELEVENLABS_API_KEY');
  const voiceId =
    getExpoPublic('EXPO_PUBLIC_ELEVENLABS_VOICE_ID_FEMALE') ||
    getExpoPublic('EXPO_PUBLIC_ELEVENLABS_VOICE_ID_MALE') ||
    getExpoPublic('EXPO_PUBLIC_ELEVENLABS_VOICE_ID') ||
    '21m00Tcm4TlvDq8ikWAM'; // Rachel — available on all ElevenLabs accounts

  // Diagnostics — always log so the console confirms what's being used
  console.log('ElevenLabs apiKey present:', !!apiKey);
  console.log('ElevenLabs apiKey length:', apiKey?.length ?? 0);
  console.log('ElevenLabs voiceId:', voiceId);

  if (!apiKey) {
    console.warn('[TTS] No ElevenLabs key — expo-speech fallback');
    await speakWithExpoSpeech(plain).catch((e) => console.warn('[TTS] expo-speech error:', e));
    _isSpeechActive = false;
    return { ok: true, reason: 'expo_speech_fallback' };
  }

  try {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: plain,
        model_id: MODEL_ID,
        voice_settings: { stability: 0.5, similarity_boost: 0.85, style: 0.2, use_speaker_boost: true },
      }),
    });

    console.log('ElevenLabs response status:', response.status);
    console.log('ElevenLabs response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      console.error('ElevenLabs error body:', errorText.slice(0, 300));
      if (_isSpeechActive) await speakWithExpoSpeech(plain).catch(() => {});
      _isSpeechActive = false;
      return { ok: true, reason: 'expo_speech_fallback' };
    }

    const buf = new Uint8Array(await response.arrayBuffer());
    console.log('[TTS] audio bytes:', buf.byteLength);

    if (buf.byteLength < 100) {
      console.warn('[TTS] tiny buffer — expo-speech fallback');
      if (_isSpeechActive) await speakWithExpoSpeech(plain).catch(() => {});
      _isSpeechActive = false;
      return { ok: true, reason: 'expo_speech_fallback' };
    }

    if (!_isSpeechActive) return { ok: false, reason: 'stopped' };

    const b64 = uint8ToBase64(buf);
    const path = `${FileSystem.cacheDirectory ?? ''}coach-tts-${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });

    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    const sound = new Audio.Sound();
    _activeSound = sound;

    try {
      await sound.loadAsync({ uri: path });

      if (!_isSpeechActive) {
        await sound.unloadAsync().catch(() => {});
        _activeSound = null;
        return { ok: false, reason: 'stopped' };
      }

      console.log('[TTS] playing...');
      await sound.playAsync();

      // Wait for playback to finish — 30s safety timeout prevents permanent lockup
      await Promise.race([
        new Promise<void>((resolve) => {
          sound.setOnPlaybackStatusUpdate((st) => {
            if (st.isLoaded && (st.didJustFinish || !_isSpeechActive)) {
              resolve();
            }
          });
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 30_000)),
      ]);

      return { ok: true };
    } catch (e) {
      console.warn('[TTS] playback error:', e);
      if (_isSpeechActive) await speakWithExpoSpeech(plain).catch(() => {});
      return { ok: true, reason: 'expo_speech_fallback' };
    } finally {
      // Always clean up audio resources and reset state flags
      await sound.unloadAsync().catch(() => {});
      _activeSound = null;
      _isSpeechActive = false;
    }
  } catch (e) {
    console.warn('[TTS] fetch threw:', e);
    if (_isSpeechActive) await speakWithExpoSpeech(plain).catch(() => {});
    _isSpeechActive = false;
    return { ok: true, reason: 'expo_speech_fallback' };
  }
}
