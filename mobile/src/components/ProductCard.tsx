import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  FONT_SIZE,
  FONT_WEIGHT,
} from '../constants';
import { Product, CurrencyEnum } from '../types';
import { AvailabilityStatus } from '../services/availabilityService';
import { distintivoDe } from '../utils/confirmarSiAgotado';

interface ProductCardProps {
  product: Product;
  quantity?: number;
  onPress: () => void;
  onAddToCart: () => void;
  availability?: AvailabilityStatus;
}

const formatPrice = (price: number, currency: CurrencyEnum): string => {
  const symbols: Record<CurrencyEnum, string> = {
    [CurrencyEnum.USD]: '$',
    [CurrencyEnum.EUR]: '€',
    [CurrencyEnum.VES]: 'Bs.',
    [CurrencyEnum.CLP]: '$',
    [CurrencyEnum.COP]: '$',
  };
  return `${symbols[currency] ?? '$'}${price.toFixed(2)}`;
};

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  quantity = 0,
  onPress,
  onAddToCart,
  availability,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      tension: 300,
      friction: 15,
      useNativeDriver: true,
    }).start();

  const onPressOut = () =>
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 300,
      friction: 15,
      useNativeDriver: true,
    }).start();

  const onAddPressIn = () =>
    Animated.spring(btnScale, {
      toValue: 0.88,
      tension: 300,
      friction: 12,
      useNativeDriver: true,
    }).start();

  const onAddPressOut = () =>
    Animated.spring(btnScale, {
      toValue: 1,
      tension: 300,
      friction: 12,
      useNativeDriver: true,
    }).start();

  const distinctivo = distintivoDe(availability);

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={1}
    >
      <Animated.View
        style={[styles.container, { transform: [{ scale: scaleAnim }] }]}
      >
        {/* Badge de disponibilidad — esquina superior izquierda */}
        {distinctivo && (
          <View style={[styles.badge, { backgroundColor: distinctivo.color }]}>
            <Text style={styles.badgeText}>{distinctivo.texto}</Text>
          </View>
        )}

        <View style={styles.content}>
          {/* Info */}
          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={2}>
              {product.name}
            </Text>
            {product.description && (
              <Text style={styles.description} numberOfLines={2}>
                {product.description}
              </Text>
            )}
            <Text style={styles.price}>
              {formatPrice(product.price, product.currency)}
            </Text>
          </View>

          {/* Imagen + botón */}
          <View style={styles.imageSection}>
            {product.imageUrl ? (
              <Image
                source={{ uri: product.imageUrl }}
                style={styles.image}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={[COLORS.surface, COLORS.backgroundSecondary]}
                style={styles.image}
              >
                <Ionicons
                  name="restaurant-outline"
                  size={30}
                  color={COLORS.textLight}
                />
              </LinearGradient>
            )}

            {/* Botón agregar con animación */}
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onAddToCart();
              }}
              onPressIn={onAddPressIn}
              onPressOut={onAddPressOut}
              activeOpacity={1}
              style={styles.addButtonWrapper}
            >
              <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                {quantity > 0 ? (
                  <View style={styles.quantityBadge}>
                    <Text style={styles.quantityText}>{quantity}</Text>
                  </View>
                ) : (
                  <View style={styles.addButtonGlowWrapper}>
                    <LinearGradient
                      colors={[COLORS.gradientStart, COLORS.gradientEnd]}
                      style={styles.addButton}
                    >
                      <Ionicons
                        name="add"
                        size={22}
                        color={COLORS.background}
                      />
                    </LinearGradient>
                  </View>
                )}
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    zIndex: 10,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
  },
  badgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.background,
  },
  content: {
    flexDirection: 'row',
    padding: SPACING.md,
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginRight: SPACING.md,
    justifyContent: 'space-between',
    minHeight: 90,
  },
  name: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
    lineHeight: 20,
  },
  description: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    lineHeight: 18,
    flex: 1,
  },
  price: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  imageSection: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  addButtonWrapper: {
    position: 'absolute',
    bottom: -10,
    right: -10,
  },
  addButtonGlowWrapper: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
    borderRadius: BORDER_RADIUS.full,
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: BORDER_RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityBadge: {
    width: 38,
    height: 38,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },
  quantityText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.background,
  },
});
