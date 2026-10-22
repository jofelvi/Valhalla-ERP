import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { precargarConfig } from './configStore';

/** Fondo neutro mientras llega la configuración (no es la marca de nadie). */
const FONDO_ARRANQUE = '#111827';

type ComponenteRaiz = React.ComponentType;

/**
 * Raíz de arranque. Espera la configuración del negocio (caché al instante; red con tope
 * de 4 s) y SOLO DESPUÉS carga la app. Motivo: la paleta se lee al cargar el módulo
 * (`StyleSheet.create` con `COLORS`), así que un import directo tomaría los colores
 * neutros. Sin red ni caché la app arranca igual, con los valores neutros.
 */
export default function ArranqueConfig() {
  const [App, setApp] = useState<ComponenteRaiz | null>(null);

  useEffect(() => {
    let vivo = true;
    void precargarConfig(4000).then(() => {
      // require, no import: el módulo de la app debe evaluarse DESPUÉS de la configuración.
      const modulo = require('../../App') as { default: ComponenteRaiz };
      if (vivo) setApp(() => modulo.default);
    });
    return () => {
      vivo = false;
    };
  }, []);

  if (!App)
    return <View style={{ flex: 1, backgroundColor: FONDO_ARRANQUE }} />;
  return <App />;
}
