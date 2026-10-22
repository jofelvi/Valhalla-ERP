import { Platform } from 'react-native';
import { COLORS } from '../constants/theme';
import { api } from './api/apiClient';

/**
 * Notificaciones push del staff (mesoneros, caja, admin).
 *
 * Usa el token NATIVO de FCM (getDevicePushTokenAsync), no el de Expo: el
 * backend habla FCM HTTP v1 directo. Antes esto pedia el token de Expo y lo
 * guardaba en `customers`, donde el backend lo descartaba — nunca funciono.
 *
 * Todo es tolerante a fallos: sin permisos, sin Firebase o sin red, la app
 * sigue funcionando igual (el WebSocket ya actualiza las pantallas abiertas).
 */

/** Canal de Android con sonido propio para distinguir "tu comida esta lista". */
const KITCHEN_CHANNEL = 'kitchen';

let registeredToken: string | null = null;

export const notificationService = {
  /**
   * Pide permiso, crea el canal y registra el token en el backend.
   * Se llama despues del login del staff. Devuelve el token o null.
   */
  async registerForPushNotifications(): Promise<string | null> {
    if (Platform.OS === 'web') return null;

    try {
      // Imports diferidos: el bundler de web no debe intentar resolverlos.
      const Notifications = await import('expo-notifications');
      const Device = await import('expo-device');

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      if (!Device.isDevice) return null;

      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Permiso de notificaciones no concedido');
        return null;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(KITCHEN_CHANNEL, {
          name: 'Cocina y barra',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 300, 200, 300],
          lightColor: COLORS.primary,
          sound: 'default',
        });
      }

      // Token nativo del dispositivo: FCM en Android, APNs en iOS. El backend
      // rutea por `platform` (iOS -> APNs directo, Android -> FCM), asi que el
      // mismo registro sirve para ambos.
      const device = await Notifications.getDevicePushTokenAsync();
      const token = String(device.data);
      if (!token) return null;

      if (token !== registeredToken) {
        await api.post('/api/push/token', {
          token,
          platform: Platform.OS,
          deviceName: Device.deviceName ?? undefined,
        });
        registeredToken = token;
      }
      return token;
    } catch (error) {
      console.warn('No se pudo registrar para notificaciones:', error);
      return null;
    }
  },

  /** Al cerrar sesion: el proximo usuario de ese telefono no debe recibir lo ajeno. */
  async unregister(): Promise<void> {
    if (!registeredToken) return;
    try {
      await api.post('/api/push/token/remove', { token: registeredToken });
    } catch {
      // Sin red da igual: el backend limpia solo los tokens muertos.
    } finally {
      registeredToken = null;
    }
  },
};
