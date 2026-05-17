import { Keyboard, Platform, type TextInputProps } from 'react-native';

/** iOS: set `inputAccessoryViewID` on `TextInput` to match */
export const SONA_INPUT_ACCESSORY_ID = 'sona-keyboard-done';

type Opts = {
  multiline?: boolean;
  onSubmit?: () => void;
};

/**
 * Standard keyboard-dismiss props for text fields (Priority 1).
 * For multiline, use returnKeyType="default" and rely on the Done accessory + "Done" bar.
 */
export function standardTextInputProps(opts: Opts = {}): Pick<
  TextInputProps,
  'returnKeyType' | 'blurOnSubmit' | 'onSubmitEditing' | 'inputAccessoryViewID'
> {
  const multiline = opts.multiline ?? false;
  return {
    returnKeyType: multiline ? 'default' : 'done',
    blurOnSubmit: !multiline,
    onSubmitEditing: multiline
      ? undefined
      : () => {
          opts.onSubmit?.();
          Keyboard.dismiss();
        },
    inputAccessoryViewID: Platform.OS === 'ios' ? SONA_INPUT_ACCESSORY_ID : undefined,
  };
}
