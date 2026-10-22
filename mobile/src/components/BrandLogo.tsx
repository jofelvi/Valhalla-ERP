import React, { useEffect, useState } from 'react';
import {
  Image,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  useColorScheme,
} from 'react-native';
import { API_URL } from '../config/env';
import { useConfig, useNombreApp } from '../config/hooks';
import { elegirLogo, iniciales } from '../config/logo';
import { useThemeColors } from '../hooks';

interface BrandLogoProps {
  /** Lado del cuadrado en puntos. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Logo del negocio, el mismo que se sube en la web (Ajustes → Marca). Si no hay logo, o la
 * imagen no carga (sin conexión la primera vez), muestra un distintivo con las iniciales del
 * nombre: la pantalla nunca queda con un hueco ni con la marca de otro negocio.
 */
export function BrandLogo({ size = 96, style }: BrandLogoProps) {
  const { marca } = useConfig();
  const nombre = useNombreApp();
  const colors = useThemeColors();
  const oscuro = useColorScheme() === 'dark';
  const uri = elegirLogo(marca, oscuro, API_URL);
  const [fallo, setFallo] = useState(false);

  // Un logo nuevo merece otro intento aunque el anterior haya fallado.
  useEffect(() => setFallo(false), [uri]);

  const caja = { width: size, height: size, borderRadius: size * 0.22 };

  if (uri && !fallo) {
    return (
      <View style={[styles.centrado, caja, style]}>
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          resizeMode="contain"
          accessibilityLabel={nombre}
          onError={() => setFallo(true)}
        />
      </View>
    );
  }

  return (
    <View
      style={[styles.centrado, caja, { backgroundColor: colors.brand }, style]}
      accessible
      accessibilityLabel={nombre}
    >
      <Text
        style={{
          color: colors['on-brand'],
          fontSize: size * 0.38,
          fontWeight: '700',
        }}
      >
        {iniciales(nombre)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centrado: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

export default BrandLogo;
