/**
 * TTS: ElevenLabs primary → expo-speech fallback (no API key needed).
 * Exports stopSpeaking() so the UI can interrupt at any time.
 */
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';

import { getSelectedCoachVoiceId } from '@/lib/coachVoiceSettings';
import { getExpoPublic } from '@/lib/expoPublicEnv';

const MODEL_ID = 'eleven_flash_v2_5'; // faster, lower latency than turbo_v2

// Module-level ref to the currently-playing Sound so we can stop it
let _activeSound: Audio.Sound | null = null;
let _isSpeechActive = false;

/** Stop any currently-playing TTS immediately */
export async function stopSpeaking(): Promise<void> {
  _isSpeechActive = false;
  if (_activeSound) {
    try { await _activeSound.stopAsync(); } catch { /* already stopped */ }
    try { await _activeSound.unloadAsync(); } catch { /* already unloaded */ }
    _activeSound = null;
  }
  // Also stop expo-speech in case it's the active engine
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
  // Process in 512-byte chunks; character-by-character concatenation blocks the JS thread
  const CHUNK = 512;
  const parts: string[] = [];
  for (let i = 0; i < bytes.byteLength; i += CHUNK) {
    const slice = Array.from(bytes.subarray(i, i + CHUNK));
    parts.push(String.fromCharCode(...slice));
  }
  return globalThis.btoa(parts.join(''));
}

/** expo-speech fallback — only used when ElevenLabs is unavailable */
async function speakWithExpoSpeech(text: string): Promise<void> {
  if (!_isSpeechActive) return;
  console.log('[TTS] expo-speech fallback');
  const available = await Speech.getAvailableVoicesAsync().catch(() => []);
  const preferred = available.find(
    (v) => v.language?.startsWith('en') && (v.name?.toLowerCase().includes('samantha') || v.name?.toLowerCase().includes('karen') || v.name?.toLowerCase().includes('female')),
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

/**
 * Synthesize with ElevenLabs and play.
 * Falls back to expo-speech ONLY if ElevenLabs key is missing or call fails.
 * Call stopSpeaking() to interrupt at any time.
 */
export async function speakCoachReply(text: string): Promise<{ ok: boolean; reason?: string }> {
  // Stop any previously-playing audio
  await stopSpeaking();

  const plain = stripForSpeech(text);
  if (!plain) return { ok: false, reason: 'empty' };
  _isSpeechActive = true;

  const apiKey = getExpoPublic('EXPO_PUBLIC_ELEVENLABS_API_KEY');
  if (!apiKey) {
    console.warn('[TTS] No ElevenLabs key — expo-speech fallback');
    await speakWithExpoSpeech(plain).catch((e) => console.warn('[TTS] expo-speech error:', e));
    _isSpeechActive = false;
    return { ok: true, reason: 'expo_speech_fallback' };
  }

  // Prefer user's stored selection (AsyncStorage), then env var default, then built-in fallback
  const voiceId = await getSelectedCoachVoiceId();
  console.log('[TTS] ElevenLabs → voice:', voiceId, 'chars:', plain.length);

  try {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: plain,
        model_id: MODEL_ID,
        voice_settings: { stability: 0.5, similarity_boost: 0.85, style: 0.2, use_speaker_boost: true },
      }),
    });
    console.log('[TTS] ElevenLabs HTTP', res.status);

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      console.warn('[TTS] ElevenLabs', res.status, errText.slice(0, 200), '— expo-speech fallback');
      if (_isSpeechActive) await speakWithExpoSpeech(plain).catch(() => {});
      _isSpeechActive = false;
      return { ok: true, reason: 'expo_speech_fallback' };
    }

    const buf = new Uint8Array(await res.arrayBuffer());
    console.log('[TTS] audio bytes:', buf.byteLength);
    if (buf.byteLength < 100) {
      console.warn('[TTS] tiny buffer — expo-speech fallback');
      if (_isSpeechActive) await speakWithExpoSpeech(plain).catch(() => {});
      _isSpeechActive = false;
      return { ok: true, reason: 'expo_speech_fallback' };
    }

    if (!_isSpeechActive) return { ok: false, reason: 'stopped' };

    const b64  = uint8ToBase64(buf);
    const path = `${FileSystem.cacheDirectory ?? ''}coach-tts-${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });

    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true });

    const sound = new Audio.Sound();
    _activeSound = sound;
    try {
      await sound.loadAsync({ uri: path });
      if (!_isSpeechActive) { await sound.unloadAsync().catch(() => {}); _activeSound = null; return { ok: false, reason: 'stopped' }; }
      console.log('[TTS] playing...');
      await sound.playAsync();
      await new Promise<void>((resolve) => {
        sound.setOnPlaybackStatusUpdate((st) => {
          if (st.isLoaded && (st.didJustFinish || !_isSpeechActive)) {
            void sound.unloadAsync().catch(() => {});
            _activeSound = null;
            resolve();
          }
        });
      });
      _isSpeechActive = false;
      return { ok: true };
    } catch (e) {
      console.warn('[TTS] playback error:', e);
      await sound.unloadAsync().catch(() => {});
      _activeSound = null;
      if (_isSpeechActive) await speakWithExpoSpeech(plain).catch(() => {});
      _isSpeechActive = false;
      return { ok: true, reason: 'expo_speech_fallback' };
    }
  } catch (e) {
    console.warn('[TTS] fetch threw:', e);
    if (_isSpeechActive) await speakWithExpoSpeech(plain).catch(() => {});
    _isSpeechActive = false;
    return { ok: true, reason: 'expo_speech_fallback' };
  }
}
