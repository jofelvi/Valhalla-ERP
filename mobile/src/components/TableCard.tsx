import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  FONT_SIZE,
  FONT_WEIGHT,
} from '../constants';
import { Table, TableStatusEnum } from '../types';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - SPACING.lg * 3) / 2;

interface TableCardProps {
  table: Table;
  onPress: () => void;
  onLongPress?: () => void;
  waiterName?: string | null;
  customerAlias?: string | null;
  orderStartTime?: Date | null;
}

const formatOrderTime = (date: Date): string => {
  try {
    const raw = date as unknown;
    // Firestore Timestamp viene como objeto con seconds
    const d =
      typeof raw === 'object' && raw !== null && 'seconds' in (raw as object)
        ? new Date((raw as { seconds: number }).seconds * 1000)
        : new Date(date);
    return d.toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

const getStatusColor = (status: TableStatusEnum): string => {
  switch (status) {
    case TableStatusEnum.ISAVAILABLE:
      return COLORS.success;
    case TableStatusEnum.OCCUPIED:
      return COLORS.error;
    case TableStatusEnum.RESERVED:
      return COLORS.info;
    case TableStatusEnum.PREPARING:
      return COLORS.warning;
    case TableStatusEnum.CLEANING:
      return COLORS.textSecondary;
    default:
      return COLORS.textSecondary;
  }
};

const getStatusLabel = (status: TableStatusEnum): string => {
  switch (status) {
    case TableStatusEnum.ISAVAILABLE:
      return 'Disponible';
    case TableStatusEnum.OCCUPIED:
      return 'Ocupada';
    case TableStatusEnum.RESERVED:
      return 'Reservada';
    case TableStatusEnum.PREPARING:
      return 'En preparación';
    case TableStatusEnum.CLEANING:
      return 'Limpiando';
    default:
      return status;
  }
};

const getStatusIcon = (status: TableStatusEnum): string => {
  switch (status) {
    case TableStatusEnum.ISAVAILABLE:
      return 'checkmark-circle-outline';
    case TableStatusEnum.OCCUPIED:
      return 'people-outline';
    case TableStatusEnum.RESERVED:
      return 'bookmark-outline';
    case TableStatusEnum.PREPARING:
      return 'restaurant-outline';
    case TableStatusEnum.CLEANING:
      return 'sparkles-outline';
    default:
      return 'help-circle-outline';
  }
};

export const TableCard: React.FC<TableCardProps> = ({
  table,
  onPress,
  onLongPress,
  waiterName,
  customerAlias,
  orderStartTime,
}) => {
  const statusColor = getStatusColor(table.status);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      tension: 250,
      friction: 12,
      useNativeDriver: true,
    }).start();

  const onPressOut = () =>
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 250,
      friction: 12,
      useNativeDriver: true,
    }).start();

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={1}
      delayLongPress={500}
    >
      <Animated.View
        style={[
          styles.container,
          { borderLeftColor: statusColor, transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Nombre de la mesa */}
        <View style={styles.header}>
          <Ionicons
            name={getStatusIcon(table.status) as 'checkmark-circle-outline'}
            size={22}
            color={statusColor}
          />
          <Text style={styles.name}>{table.name}</Text>
        </View>

        {/* Capacidad */}
        <View style={styles.infoRow}>
          <Ionicons
            name="people-outline"
            size={14}
            color={COLORS.textSecondary}
          />
          <Text style={styles.capacity}>{table.capacity} personas</Text>
        </View>

        {/* Mesonero asignado */}
        {waiterName && table.status === TableStatusEnum.OCCUPIED && (
          <View style={styles.waiterRow}>
            <Ionicons name="person-outline" size={13} color={COLORS.primary} />
            <Text style={styles.waiterName} numberOfLines={1}>
              {waiterName}
            </Text>
          </View>
        )}

        {/* Alias del cliente */}
        {customerAlias && table.status === TableStatusEnum.OCCUPIED && (
          <View style={styles.aliasRow}>
            <Ionicons name="pricetag-outline" size={13} color={COLORS.info} />
            <Text style={styles.aliasText} numberOfLines={1}>
              {customerAlias}
            </Text>
          </View>
        )}

        {/* Hora de inicio */}
        {orderStartTime && table.status === TableStatusEnum.OCCUPIED && (
          <View style={styles.timeRow}>
            <Ionicons
              name="time-outline"
              size={13}
              color={COLORS.textSecondary}
            />
            <Text style={styles.timeText}>
              {formatOrderTime(orderStartTime)}
            </Text>
          </View>
        )}

        {/* Badge de estado */}
        <View
          style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}
        >
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {getStatusLabel(table.status)}
          </Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  name: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  capacity: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  waiterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
    backgroundColor: `${COLORS.primary}10`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.sm,
  },
  waiterName: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.primary,
    flex: 1,
  },
  aliasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
    backgroundColor: `${COLORS.info}10`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.sm,
  },
  aliasText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.info,
    flex: 1,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  timeText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 1,
    borderRadius: BORDER_RADIUS.full,
    alignSelf: 'flex-start',
    gap: SPACING.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
  },
});
