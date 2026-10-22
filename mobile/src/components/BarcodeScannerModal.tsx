import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCameraPermissions } from 'expo-camera';
import { CameraView } from 'expo-camera';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
} from '../constants';

const { width: screenWidth } = Dimensions.get('window');

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (code: string) => void;
}

interface BarcodeScanningResult {
  type: string;
  data: string;
}

interface BarcodeDetectorAPI {
  new (options: { formats: string[] }): {
    detect(source: HTMLVideoElement): Promise<BarcodeScanningResult[]>;
  };
}

type VideoStyle = Record<string, unknown>;

// Detecta si existe BarcodeDetector en el navegador
const isBarcodeDetectorAvailable = (): boolean => {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
};

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  visible,
  onClose,
  onScanned,
}) => {
  const insets = useSafeAreaInsets();
  // Estado general
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const scannedOnceRef = useRef(false);

  // Hook de permisos de cámara (nativo)
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Estado web
  const [webBarcodeDetector, setWebBarcodeDetector] = useState<unknown>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const detectionLoopRef = useRef<NodeJS.Timeout | null>(null);

  // Solicitar permiso de cámara al abrir (nativo)
  useEffect(() => {
    if (!visible || Platform.OS === 'web') return;

    if (!cameraPermission?.granted) {
      requestCameraPermission();
    } else {
      setIsScanning(true);
    }
  }, [visible, cameraPermission, requestCameraPermission]);

  // Inicializar web scanner si está disponible
  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || !isBarcodeDetectorAvailable())
      return;

    try {
      const windowWithBarcodeDetector = window as unknown as {
        BarcodeDetector: BarcodeDetectorAPI;
      };
      const detector = new windowWithBarcodeDetector.BarcodeDetector({
        // 'qr_code' para leer la ficha de barra (token AR1.) tambien en web.
        formats: ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
      });
      setWebBarcodeDetector(detector);
      setIsScanning(true);

      // Solicitar acceso a la cámara
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();

            // Iniciar loop de detección
            const detectionLoop = async () => {
              try {
                if (!videoRef.current || !detector || scannedOnceRef.current)
                  return;

                const barcodes: BarcodeScanningResult[] = await detector.detect(
                  videoRef.current,
                );
                if (barcodes.length > 0) {
                  scannedOnceRef.current = true;
                  const code = barcodes[0].data;

                  // Detener stream
                  stream.getTracks().forEach((track) => track.stop());
                  setIsScanning(false);
                  if (detectionLoopRef.current)
                    clearTimeout(detectionLoopRef.current);

                  onScanned(code);
                  handleClose();
                  return;
                }

                detectionLoopRef.current = setTimeout(detectionLoop, 300);
              } catch (error) {
                console.error('[BarcodeScannerModal] Detection error:', error);
              }
            };

            detectionLoop();
          }
        })
        .catch((error) => {
          console.error('[BarcodeScannerModal] Camera access error:', error);
          setIsScanning(false);
        });
    } catch (error) {
      console.error(
        '[BarcodeScannerModal] Error initializing detector:',
        error,
      );
      setIsScanning(false);
    }

    return () => {
      // Limpiar loop de detección
      if (detectionLoopRef.current) {
        clearTimeout(detectionLoopRef.current);
      }
      // Detener stream de video
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [visible, onScanned]);

  // Resetear estados al abrir/cerrar
  useEffect(() => {
    if (!visible) {
      scannedOnceRef.current = false;
      setManualCode('');
    }
  }, [visible]);

  const handleClose = () => {
    // Limpiar
    if (detectionLoopRef.current) {
      clearTimeout(detectionLoopRef.current);
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
    scannedOnceRef.current = false;
    setManualCode('');
    setIsScanning(false);
    onClose();
  };

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      onScanned(manualCode.trim());
      handleClose();
    }
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (!scannedOnceRef.current) {
      scannedOnceRef.current = true;
      onScanned(result.data);
      handleClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Escanear Código de Barras</Text>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={24} color={COLORS.background} />
          </TouchableOpacity>
        </View>

        {/* Contenido */}
        <View style={styles.content}>
          {Platform.OS === 'web' ? (
            // Web: video element o input manual
            <>
              {isBarcodeDetectorAvailable() && isScanning ? (
                <View style={styles.cameraContainer}>
                  <video
                    ref={videoRef as React.Ref<HTMLVideoElement>}
                    style={styles.video}
                    playsInline
                    autoPlay
                  />
                  <View style={styles.scannerFrame}>
                    <View style={styles.frameCornerTL} />
                    <View style={styles.frameCornerTR} />
                    <View style={styles.frameCornerBL} />
                    <View style={styles.frameCornerBR} />
                  </View>
                </View>
              ) : (
                <View style={styles.placeholder}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={48}
                    color={COLORS.warning}
                  />
                  <Text style={styles.placeholderText}>
                    BarcodeDetector no disponible en este navegador
                  </Text>
                </View>
              )}
            </>
          ) : cameraPermission?.granted ? (
            // Nativo: CameraView con barcode scanner
            <View style={styles.cameraContainer}>
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{
                  // 'qr' es imprescindible para leer la ficha de barra (token AR1.).
                  // Sin el, expo-camera nunca dispara onBarcodeScanned con un QR.
                  barcodeTypes: [
                    'qr',
                    'ean13',
                    'ean8',
                    'upc_a',
                    'upc_e',
                    'code128',
                  ],
                }}
                onBarcodeScanned={handleBarcodeScanned}
              />
              <View style={styles.scannerFrame}>
                <View style={styles.frameCornerTL} />
                <View style={styles.frameCornerTR} />
                <View style={styles.frameCornerBL} />
                <View style={styles.frameCornerBR} />
              </View>
            </View>
          ) : (
            // Permiso denegado o pendiente
            <View style={styles.placeholder}>
              <Ionicons name="lock-closed" size={48} color={COLORS.error} />
              <Text style={styles.placeholderText}>
                Permiso de cámara denegado
              </Text>
              {cameraPermission?.canAskAgain ? (
                <TouchableOpacity
                  style={styles.permissionButton}
                  onPress={() => requestCameraPermission()}
                >
                  <Ionicons name="camera" size={20} color={COLORS.background} />
                  <Text style={styles.permissionButtonText}>
                    Solicitar Permiso
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.permissionDeniedText}>
                  Habilita los permisos en la configuración del dispositivo
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Input manual */}
        <View
          style={[styles.footer, { paddingBottom: SPACING.lg + insets.bottom }]}
        >
          <Text style={styles.manualLabel}>
            O escribe el código manualmente
          </Text>
          <View style={styles.manualInputContainer}>
            <Ionicons name="barcode" size={20} color={COLORS.textSecondary} />
            <TextInput
              style={styles.manualInput}
              placeholder="Código de barras..."
              placeholderTextColor={COLORS.textSecondary}
              value={manualCode}
              onChangeText={setManualCode}
              onSubmitEditing={handleManualSubmit}
              keyboardType="numeric"
              autoFocus
            />
            <TouchableOpacity
              onPress={handleManualSubmit}
              disabled={!manualCode.trim()}
              style={[
                styles.manualButton,
                !manualCode.trim() && styles.manualButtonDisabled,
              ]}
            >
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={
                  manualCode.trim() ? COLORS.primary : COLORS.textSecondary
                }
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.text,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.primary,
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraContainer: {
    flex: 1,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  } as VideoStyle,
  scannerFrame: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 250,
    height: 250,
    marginTop: -125,
    marginLeft: -125,
  },
  frameCornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 30,
    height: 30,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: COLORS.primary,
  },
  frameCornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 30,
    height: 30,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: COLORS.primary,
  },
  frameCornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 30,
    height: 30,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: COLORS.primary,
  },
  frameCornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: COLORS.primary,
  },
  placeholder: {
    alignItems: 'center',
    gap: SPACING.md,
  },
  placeholderText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.background,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
  },
  permissionButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.background,
  },
  permissionDeniedText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.background,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  manualLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  manualInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  manualInput: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    paddingVertical: SPACING.md,
  },
  manualButton: {
    padding: SPACING.sm,
  },
  manualButtonDisabled: {
    opacity: 0.5,
  },
});
