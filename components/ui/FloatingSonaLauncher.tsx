import { useSegments } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useSonaVoice } from '@/contexts/SonaVoiceContext';
import { SonaVoiceButton, type SonaVoiceVisualState } from '@/components/ui/SonaVoiceButton';

export function FloatingSonaLauncher() {
  const segments = useSegments();
  const { sonaState, isListening, startListening, stopListening } = useSonaVoice();

  const isOnSonaTab = segments[0] === 'patient' && segments[1] === 'sona';
  if (isOnSonaTab) return null;

  const state: SonaVoiceVisualState =
    sonaState === 'listening'
      ? 'listening'
      : sonaState === 'thinking'
        ? 'thinking'
        : sonaState === 'speaking'
          ? 'speaking'
          : 'inactive';

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <SonaVoiceButton
        state={state}
        onPress={() => {
          if (isListening) {
            stopListening();
            return;
          }
          void startListening();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    zIndex: 999,
    elevation: 12,
    transform: [{ scale: 0.86 }],
  },
});
