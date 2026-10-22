import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useAuthStore } from '../store/authStore';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../constants';
import { decidirAviso, MENSAJES } from './avisoDeConexion';

/**
 * Aviso de que la app no esta hablando con el servidor.
 *
 * Por que existe: se midieron 28 cortes de internet en 30 dias, 13 de mas
 * de media hora y el peor de 1h56m, varios en hora pico. Hasta ahora el
 * mesonero solo veia un toast que decia "Network request failed", que no
 * distingue tres cosas muy distintas para el que esta atendiendo una mesa:
 * que se cayo el WiFi, que el WiFi esta bien pero el servidor no contesta,
 * o que el pedido que acaba de mandar no se guardo.
 *
 * El sensor (`useNetworkStatus` + `isOffline` del authStore) ya existia
 * desde antes; lo que faltaba era que alguien lo mostrara: la unica
 * referencia al hook fuera de su propio archivo era el barrel de hooks.
 *
 * VA EN EL FLUJO, NO ENCIMA. La primera version de este componente era
 * `position:absolute; top:0` sobre el NavigationContainer, y asi tapaba la
 * cabecera de la pantalla — incluida la flecha de volver. En una caja con
 * la fila esperando, un aviso que te come el boton de retroceso es peor
 * que no tener aviso. Ocupa su propia franja y empuja la app hacia abajo.
 */

type NombreDeIcono = React.ComponentProps<typeof Ionicons>['name'];

interface Aviso {
  mensaje: string;
  icono: NombreDeIcono;
  fondo: string;
}

export const OfflineBanner: React.FC = () => {
  const isOffline = useAuthStore((state) => state.isOffline);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // null = todavia no sabemos (NetInfo no reporto). No es lo mismo que
  // "sin red": decir "sin conexion" cuando el WiFi esta bien manda a la
  // gente a revisar el router en vez de avisar que el servidor no contesta.
  const [hayRed, setHayRed] = useState<boolean | null>(null);
  const opacidad = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const desuscribir = NetInfo.addEventListener((estado) => {
      setHayRed(estado.isConnected ?? null);
    });

    // NetInfo NO alcanza en la PWA, y esto costo encontrarlo: su
    // implementacion web (`nativeModule.web.js`) se suscribe a
    // `connection.change` cuando existe `navigator.connection` —que en
    // Chrome y Edge existe— y solo cae a `window.online`/`offline` cuando NO
    // existe. `connection.change` no dispara al perder la red: lo que cambia
    // es `navigator.onLine`. Resultado medido sobre la PWA en produccion:
    // se corto la red, `navigator.onLine` paso a false, el evento `offline`
    // se disparo... y el aviso no salio, porque NetInfo nunca reporto.
    //
    // En el APK esto no hace nada (el `window` de React Native no emite
    // estos eventos) y NetInfo sigue siendo la fuente. En la web, es LA
    // fuente.
    const w: typeof globalThis & {
      addEventListener?: typeof window.addEventListener;
      removeEventListener?: typeof window.removeEventListener;
      navigator?: { onLine?: boolean };
    } = globalThis;

    if (typeof w.addEventListener !== 'function') return () => desuscribir?.();

    const alCambiar = () => setHayRed(w.navigator?.onLine ?? null);
    alCambiar(); // estado inicial, sin esperar al primer evento
    w.addEventListener('online', alCambiar);
    w.addEventListener('offline', alCambiar);

    return () => {
      desuscribir?.();
      w.removeEventListener?.('online', alCambiar);
      w.removeEventListener?.('offline', alCambiar);
    };
  }, []);

  const tipo = decidirAviso({ isOffline, isAuthenticated, hayRed });
  const mostrar = tipo !== 'ninguno';

  useEffect(() => {
    Animated.timing(opacidad, {
      toValue: mostrar ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [mostrar, opacidad]);

  if (!mostrar) return null;

  const aviso: Aviso =
    tipo === 'sin_red'
      ? {
          mensaje: MENSAJES.sin_red,
          icono: 'wifi-outline',
          fondo: COLORS.warning,
        }
      : {
          mensaje: MENSAJES.servidor_mudo,
          icono: 'alert-circle-outline',
          fondo: COLORS.error,
        };

  return (
    <Animated.View
      style={[styles.franja, { backgroundColor: aviso.fondo, opacity: opacidad }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Ionicons name={aviso.icono} size={16} color={COLORS.textWhite} />
      <Text style={styles.mensaje}>{aviso.mensaje}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  franja: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  mensaje: {
    color: COLORS.textWhite,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    textAlign: 'center',
  },
});
