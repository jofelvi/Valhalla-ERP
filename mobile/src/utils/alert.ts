import { Alert, AlertButton, Platform } from 'react-native';

/**
 * Alert cross-platform: Alert.alert es un no-op en react-native-web,
 * así que en la PWA usamos window.alert / window.confirm.
 * 1 botón = aviso; 2 = confirmar/cancelar; 3+ = una confirmación por
 * opción, en orden ("¿Volver a Mesa 3?", "¿Descartar y cambiar?"): la
 * primera aceptada se ejecuta; si se rechazan todas, corre la de cancelar.
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  const options = buttons.filter((b) => b.style !== 'cancel');
  const cancelButton = buttons.find((b) => b.style === 'cancel');

  if (options.length <= 1) {
    if (window.confirm(text)) options[0]?.onPress?.();
    else cancelButton?.onPress?.();
    return;
  }

  const chosen = options.find((b) =>
    window.confirm(`${text}\n\n¿${b.text ?? 'Continuar'}?`),
  );
  if (chosen) chosen.onPress?.();
  else cancelButton?.onPress?.();
}
