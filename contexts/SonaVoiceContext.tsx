import React, { createContext, useContext, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';

import { routeSonaIntent } from '@/lib/sonaIntentRouter';
import { ExpoSpeechRecognitionModule, hasSpeechRecognition } from '@/lib/safeSpeechRecognition';

type SonaState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface SonaVoiceContextType {
  isListening: boolean;
  currentTranscript: string;
  sonaResponse: string;
  sonaState: SonaState;
  startListening: () => void;
  stopListening: () => void;
  handleTranscriptFinal: (transcript: string) => void;
}

const SonaVoiceContext = createContext<SonaVoiceContextType | null>(null);

export function SonaVoiceProvider({ children }: { children: React.ReactNode }) {
  const [isListening, setIsListening] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [sonaResponse, setSonaResponse] = useState('');
  const [sonaState, setSonaState] = useState<SonaState>('idle');

  const startListening = async () => {
    if (!hasSpeechRecognition || !ExpoSpeechRecognitionModule) return;
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) return;
    const perms = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perms.granted) {
      Alert.alert('Microphone permission needed', 'Please allow microphone access in Settings.');
      return;
    }
    setIsListening(true);
    setSonaState('listening');
    setCurrentTranscript('');
    setSonaResponse('');
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: false,
      addsPunctuation: true,
    });
  };

  const stopListening = () => {
    setIsListening(false);
    setSonaState('idle');
    setCurrentTranscript('');
    if (ExpoSpeechRecognitionModule) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        // ignore
      }
    }
  };

  const handleTranscriptFinal = async (transcript: string) => {
    setCurrentTranscript(transcript);
    setSonaState('thinking');
    setIsListening(false);

    const intent = routeSonaIntent(transcript);

    if (intent.type === 'navigate' && intent.route) {
      setSonaResponse(intent.confirmationMessage ?? 'Got it — taking you there.');
      setSonaState('speaking');
      router.push({ pathname: intent.route as never, params: intent.params as never });
      setTimeout(() => {
        setSonaState('idle');
        setSonaResponse('');
      }, 2000);
    } else {
      setSonaState('thinking');
    }
  };

  const value = useMemo(
    () => ({
      isListening,
      currentTranscript,
      sonaResponse,
      sonaState,
      startListening,
      stopListening,
      handleTranscriptFinal,
    }),
    [isListening, currentTranscript, sonaResponse, sonaState],
  );

  return <SonaVoiceContext.Provider value={value}>{children}</SonaVoiceContext.Provider>;
}

export function useSonaVoice() {
  const ctx = useContext(SonaVoiceContext);
  if (!ctx) throw new Error('useSonaVoice must be used within SonaVoiceProvider');
  return ctx;
}
