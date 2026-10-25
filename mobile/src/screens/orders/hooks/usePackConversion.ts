import { useState, useEffect, useCallback } from 'react';
import {
  opcionesDeConversion,
  aplicarConversion,
  type ConversionOption,
} from '../../../services/packConversion';
import { showAlert } from '../../../utils/alert';
import { useModal } from '../../../hooks/useModal';
import { useModulo } from '../../../config/hooks';

export const usePackConversion = (orderId: string | null) => {
  const packConversionModal = useModal('orderDetailPackConversion');
  // Con el modulo apagado la API responde 404: no se pregunta.
  const packsActivos = useModulo('packsAndBuckets');
  const [isConvertingPacks, setIsConvertingPacks] = useState(false);
  const [conversionOptions, setConversionOptions] = useState<
    ConversionOption[]
  >([]);
  const [packsElegidos, setPacksElegidos] = useState<Record<string, number>>(
    {},
  );

  const claveDeOpcion = useCallback(
    (o: ConversionOption) => `${o.sourceProductId}:${o.targetPackId}`,
    [],
  );

  useEffect(() => {
    if (!orderId || !packsActivos) {
      setConversionOptions([]);
      return;
    }
    let vigente = true;
    opcionesDeConversion(orderId)
      .then((opts) => {
        if (vigente) setConversionOptions(opts);
      })
      .catch(() => {
        // Sin opciones el boton no aparece. Si la API todavia no tiene el
        // endpoint (APK nueva contra API vieja), la pantalla sigue viva.
        if (vigente) setConversionOptions([]);
      });
    return () => {
      vigente = false;
    };
  }, [orderId, packsActivos]);

  const handleExecuteConversion = useCallback(
    async (option: ConversionOption) => {
      if (!orderId) return;
      const packsToConvert = packsElegidos[claveDeOpcion(option)] ?? 1;
      try {
        setIsConvertingPacks(true);

        // UNA llamada. Antes eran tres (PATCH de items, totales calculados en
        // el telefono y POST de la nota), y entre una y otra la orden podia
        // quedar convertida sin su rastro. El servidor lo guarda todo junto.
        await aplicarConversion(orderId, {
          sourceProductId: option.sourceProductId,
          targetPackId: option.targetPackId,
          packsToConvert,
        });
        // La orden actualizada llega por `subscribeToOrder`, que la normaliza.
        // No se toca `setOrder` a mano: es lo que hacen las demas mutaciones de
        // esta pantalla, y evita meter el JSON crudo de la API en el estado.

        showAlert(
          'Conversion aplicada',
          `${packsToConvert} x ${option.packName}. Ahorro: $${(option.savingsUsd * packsToConvert).toFixed(2)}`,
        );
        packConversionModal.close();
      } catch (error: unknown) {
        showAlert(
          'No se pudo convertir',
          error instanceof Error
            ? error.message
            : 'El servidor rechazo la conversion',
        );
      } finally {
        setIsConvertingPacks(false);
      }
    },
    [orderId, packsElegidos, claveDeOpcion, packConversionModal],
  );

  return {
    packConversionModal,
    isConvertingPacks,
    conversionOptions,
    packsElegidos,
    setPacksElegidos,
    claveDeOpcion,
    handleExecuteConversion,
  };
};
