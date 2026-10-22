import { useEffect, useRef, useState } from 'react';
import { PaymentStatusEnum } from '@/shared';
import {
  saveBcvRateToCache,
  getBcvRateFromCache,
} from '@/shared/utils/bcvRateCache';
import type { Order } from '@/modelTypes/order';

interface ToastArg {
  title: string;
  description: string;
}
interface UseTasaBcvArgs {
  order: Order | undefined;
  toast: {
    warning: (o: ToastArg) => void;
    error: (o: ToastArg) => void;
  };
}

interface UseTasaBcvReturn {
  /** Tasa BCV vigente para convertir USD↔Bs. 0 = sin tasa (montos en Bs en 0). */
  bcvRate: number;
  loadingRate: boolean;
  /** true si la tasa viene del caché o no hay tasa real (avisar al cajero). */
  isUsingDefaultRate: boolean;
  /** Reintenta cargar la tasa desde la API (uso manual del botón refrescar). */
  handleRefreshBcvRate: () => void;
}

/**
 * Carga y mantiene la tasa BCV de la pantalla de cobro. Extracción FIEL del
 * código que vivía en page.tsx (mismo endpoint `/api/bcv-rate`, mismo caché,
 * mismos avisos). No se inventa una tasa: sin tasa real queda en 0 y el cajero
 * la escribe a mano (el 19/08/2026 un relleno de 50 con la tasa real en 775
 * mostró $195,80 como Bs 9.790 y cobrar ahí era cobrar el 6%).
 */
export function useTasaBcv({ order, toast }: UseTasaBcvArgs): UseTasaBcvReturn {
  const [bcvRate, setBcvRate] = useState<number>(0);
  const [loadingRate, setLoadingRate] = useState(false);
  const [isUsingDefaultRate, setIsUsingDefaultRate] = useState(false);

  // Un solo toast de aviso por carga; ref para no repetirlo en cada re-render.
  const bcvToastShownRef = useRef(false);
  // Marca que la tasa se fijó desde la orden del mesonero.
  const bcvRateFromOrderRef = useRef(false);

  const loadBcvRate = async () => {
    setLoadingRate(true);
    try {
      const response = await fetch('/api/bcv-rate');
      const data = await response.json();
      console.log('📊 Respuesta BCV:', data);

      // Si la respuesta es exitosa, guardar en caché y usar
      if (data.success && data.rate) {
        setBcvRate(data.rate);
        saveBcvRateToCache(data.rate, data.sourceDetail || data.source);
        setIsUsingDefaultRate(false);
        console.log(
          `✅ Tasa BCV actualizada: ${data.rate} desde ${data.sourceDetail || data.source}`,
        );
      } else {
        // Si falla la API, intentar usar el caché
        const cachedRate = getBcvRateFromCache();
        if (cachedRate) {
          setBcvRate(cachedRate.rate);
          setIsUsingDefaultRate(true);
          console.warn(
            `⚠️ Usando tasa del caché: ${cachedRate.rate} (guardada el ${cachedRate.date})`,
          );

          // Mostrar toast informativo sobre el caché
          if (!bcvToastShownRef.current) {
            bcvToastShownRef.current = true;
            toast.warning({
              title: 'Tasa BCV desde caché',
              description: `Usando última tasa conocida: ${cachedRate.rate} (${cachedRate.date})`,
            });
          }
        } else {
          // NUNCA inventar una tasa. El 19/08/2026 el relleno de 50 con la tasa
          // real en 775 hizo que una cuenta de $195,80 se mostrara como Bs 9.790:
          // cobrar ahí era cobrar el 6%. Sin tasa real se deja en 0, los montos
          // en Bs quedan en 0 (visiblemente roto) y el cajero la escribe a mano.
          setBcvRate(0);
          setIsUsingDefaultRate(true);
          console.error('❌ No hay tasa BCV disponible');

          if (!bcvToastShownRef.current) {
            bcvToastShownRef.current = true;
            toast.error({
              title: 'Sin tasa BCV',
              description:
                'No se pudo obtener la tasa. Escríbela a mano con el lápiz antes de cobrar en bolívares.',
            });
          }
        }
      }
    } catch (error) {
      console.error('❌ Error cargando tasa BCV:', error);

      // Intentar usar caché en caso de error de red
      const cachedRate = getBcvRateFromCache();
      if (cachedRate) {
        setBcvRate(cachedRate.rate);
        setIsUsingDefaultRate(true);
        console.warn(`⚠️ Error de red, usando caché: ${cachedRate.rate}`);

        if (!bcvToastShownRef.current) {
          bcvToastShownRef.current = true;
          toast.warning({
            title: 'Sin conexión',
            description: `Usando tasa guardada: ${cachedRate.rate} (${cachedRate.date})`,
          });
        }
      } else {
        // Sin caché y sin red: tampoco se inventa (ver comentario de arriba).
        setBcvRate(0);
        setIsUsingDefaultRate(true);

        if (!bcvToastShownRef.current) {
          bcvToastShownRef.current = true;
          toast.error({
            title: 'Sin tasa BCV',
            description:
              'No hay conexión ni tasa guardada. Escríbela a mano con el lápiz antes de cobrar en bolívares.',
          });
        }
      }
    } finally {
      setLoadingRate(false);
    }
  };

  // Cargar tasa BCV una vez que la orden esté disponible.
  // Se ejecuta una sola vez por orden (guardia con ref) para evitar refetches
  // innecesarios de la API si el componente re-renderiza.
  const bcvLoadedForOrderRef = useRef<string | null>(null);
  useEffect(() => {
    if (!order) return;
    if (bcvLoadedForOrderRef.current === order.id) return;
    bcvLoadedForOrderRef.current = order.id;

    if (
      order.paymentStatus === PaymentStatusEnum.PENDING_VERIFICATION &&
      order.bcvRate
    ) {
      setBcvRate(order.bcvRate);
      setIsUsingDefaultRate(false);
      bcvRateFromOrderRef.current = true;
    } else {
      void loadBcvRate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);

  const handleRefreshBcvRate = () => {
    // Resetear el ref para permitir mostrar toast en actualización manual
    bcvToastShownRef.current = false;
    void loadBcvRate();
  };

  return { bcvRate, loadingRate, isUsingDefaultRate, handleRefreshBcvRate };
}
