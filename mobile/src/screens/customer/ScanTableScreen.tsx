import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { orderService } from '../../services';
import { ApiError } from '../../services/api/apiClient';
import {
  LINK_TOKEN_PREFIX,
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
} from '../../constants';
import type { RootStackParamList } from '../../navigation/types';
import { showAlert } from '../../utils/alert';
import { Button } from '../../components/ui';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ScanTable'>;

/**
 * Escaner de QR de mesa. El mesonero muestra un QR (prefijo ARL1.) sobre la
 * orden que abrio; al escanearlo, el cliente queda vinculado a esa orden y
 * puede pedir productos, llamar al mesonero, pedir la cuenta y chatear.
 */
export const ScanTableScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const [permission, requestPermission] = useCameraPermissions();
  const [linking, setLinking] = useState(false);
  // Evita procesar el mismo QR varias veces mientras la peticion viaja.
  const lockRef = useRef(false);

  const handleScanned = useCallback(
    async (result: BarcodeScanningResult) => {
      const raw = result.data?.trim() ?? '';
      if (lockRef.current) return;
      if (!raw.startsWith(`${LINK_TOKEN_PREFIX}.`)) return; // no es un QR de mesa
      lockRef.current = true;
      setLinking(true);
      try {
        const order = await orderService.linkByToken(raw);
        navigation.replace('MyTable', { orderId: order.id });
      } catch (err) {
        const msg =
          err instanceof ApiError && err.status === 401
            ? 'Debes iniciar sesion para conectarte a la mesa.'
            : err instanceof ApiError && err.status === 404
              ? 'Este codigo ya no es valido. Pidele al mesonero uno nuevo.'
              : 'No se pudo conectar a la mesa. Intenta de nuevo.';
        showAlert('Mesa conectada', msg, [
          {
            text: 'Reintentar',
            onPress: () => {
              lockRef.current = false;
              setLinking(false);
            },
          },
        ]);
      }
    },
    [navigation],
  );

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Ionicons
          name="camera-outline"
          size={64}
          color={COLORS.textSecondary}
        />
        <Text style={styles.permTitle}>Permiso de camara</Text>
        <Text style={styles.permText}>
          Necesitamos la camara para escanear el QR de tu mesa.
        </Text>
        <Button
          label="Permitir camara"
          variant="primary"
          onPress={requestPermission}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={linking ? undefined : handleScanned}
      />
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.frame} />
        <Text style={styles.hint}>Apunta al QR que te muestra el mesonero</Text>
      </View>
      {linking && (
        <View style={styles.linkingBox}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.linkingText}>Conectando a la mesa...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.shadow },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frame: {
    width: 240,
    height: 240,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 3,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
  },
  hint: {
    marginTop: SPACING.lg,
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
  linkingBox: {
    position: 'absolute',
    bottom: SPACING.xxl,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  linkingText: { color: COLORS.text, fontSize: FONT_SIZE.sm },
  permTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
  },
  permText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
  },
});
