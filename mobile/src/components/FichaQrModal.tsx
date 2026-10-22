import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
} from '../constants';
import { fichaService, FichaView } from '../services/fichaService';
import { enqueuePrintFicha } from '../services/printQueueService';
import { showAlert } from '../utils/alert';

interface FichaQrModalProps {
  visible: boolean;
  orderId: string | null;
  onClose: () => void;
}

export const FichaQrModal: React.FC<FichaQrModalProps> = ({
  visible,
  orderId,
  onClose,
}) => {
  const [ficha, setFicha] = useState<FichaView | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !orderId) return;
    setLoading(true);
    fichaService
      .getByOrderId(orderId)
      .then(setFicha)
      .catch((e) =>
        showAlert(
          'Ficha',
          e instanceof Error ? e.message : 'No se pudo cargar',
        ),
      )
      .finally(() => setLoading(false));
  }, [visible, orderId]);

  const reprint = () => {
    if (!orderId) return;
    enqueuePrintFicha(orderId).catch(() => {
      showAlert('Impresión', 'No se pudo enviar a imprimir');
    });
  };

  const totalPending =
    ficha?.items.reduce((s, it) => s + it.pendingQty, 0) ?? 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.close} onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={26} color={COLORS.textSecondary} />
          </TouchableOpacity>

          {loading || !ficha ? (
            <ActivityIndicator color={COLORS.primary} size="large" />
          ) : (
            <>
              <Text style={styles.title}>Ficha #{ficha.orderNumber}</Text>
              <View style={styles.qrBox}>
                <QRCode value={ficha.fichaToken} size={220} />
              </View>
              <Text style={styles.pending}>Pendiente: {totalPending}</Text>
              {ficha.items.map((it) => (
                <Text key={it.itemId} style={styles.item}>
                  {it.productName}: {it.pendingQty}
                </Text>
              ))}
              <TouchableOpacity style={styles.btn} onPress={reprint}>
                <Ionicons name="print" size={18} color={COLORS.textWhite} />
                <Text style={styles.btnText}>Reimprimir ficha</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    width: '100%',
  },
  close: { alignSelf: 'flex-end' },
  title: {
    color: COLORS.textWhite,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    marginBottom: SPACING.md,
  },
  qrBox: {
    backgroundColor: COLORS.textWhite,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  pending: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    marginTop: SPACING.md,
  },
  item: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  btn: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.lg,
  },
  btnText: { color: COLORS.textWhite, fontWeight: FONT_WEIGHT.semibold },
});
