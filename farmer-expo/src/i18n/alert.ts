import { Alert, type AlertButton, type AlertOptions } from 'react-native';
import { tr } from './index';

/**
 * Drop-in for `Alert.alert` that translates the title, message and button
 * labels to the app language. Same signature.
 */
export function alertT(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions,
): void {
  Alert.alert(
    tr(title),
    message ? tr(message) : undefined,
    buttons?.map((b) => ({ ...b, text: b.text ? tr(b.text) : b.text })),
    options,
  );
}
