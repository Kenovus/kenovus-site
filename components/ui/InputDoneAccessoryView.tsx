import { useMemo } from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text } from 'react-native';

import { SONA_INPUT_ACCESSORY_ID } from '@/lib/textInputStandard';

/**
 * iOS-only persistent "Done" bar above the keyboard. Wire each TextInput with
 * `inputAccessoryViewID={SONA_INPUT_ACCESSORY_ID}` (see `standardTextInputProps`).
 */
export function InputDoneAccessoryView() {
  const id = useMemo(() => SONA_INPUT_ACCESSORY_ID, []);
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={id} backgroundColor="rgba(30,32,40,0.95)">
      <Pressable
        style={styles.bar}
        onPress={() => Keyboard.dismiss()}
        accessibilityRole="button"
        accessibilityLabel="Done">
        <Text style={styles.done}>Done</Text>
      </Pressable>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(201,168,76,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  done: {
    color: '#C9A84C',
    fontSize: 17,
    fontWeight: '600',
  },
});
