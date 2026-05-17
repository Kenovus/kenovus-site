type SpeechEventName = 'start' | 'end' | 'result' | 'error';

type SpeechEventPayload = {
  results?: Array<{ transcript?: string }>;
};

type UseSpeechEvent = (event: SpeechEventName, cb: (payload: SpeechEventPayload) => void) => void;

type SpeechModule = {
  stop: () => void;
  isRecognitionAvailable: () => boolean;
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  start: (opts: {
    lang: string;
    interimResults?: boolean;
    continuous?: boolean;
    addsPunctuation?: boolean;
  }) => void;
};

let speechModule: SpeechModule | null = null;
let useSpeechEvent: UseSpeechEvent = () => {
  /* no-op fallback in Expo Go / unavailable native module */
};

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const loaded = require('expo-speech-recognition') as {
    ExpoSpeechRecognitionModule?: SpeechModule;
    useSpeechRecognitionEvent?: UseSpeechEvent;
  };
  speechModule = loaded.ExpoSpeechRecognitionModule ?? null;
  if (loaded.useSpeechRecognitionEvent) useSpeechEvent = loaded.useSpeechRecognitionEvent;
} catch {
  speechModule = null;
}

export const ExpoSpeechRecognitionModule = speechModule;
export const useSpeechRecognitionEvent = useSpeechEvent;
export const hasSpeechRecognition = Boolean(speechModule);
