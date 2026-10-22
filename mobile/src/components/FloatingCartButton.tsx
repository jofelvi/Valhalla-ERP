import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
import { useCartStore } from '../store';

interface FloatingCartButtonProps {
  onPress: () => void;
}

const formatPrice = (price: number): string => `$${price.toFixed(2)}`;

export const FloatingCartButton: React.FC<FloatingCartButtonProps> = ({
  onPress,
}) => {
  const { getTotal, getItemCount } = useCartStore();
  const itemCount = getItemCount();
  const total = getTotal();

  const mountScale = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const prevCount = useRef(0);
  const bounceAnim = useRef(new Animated.Value(1)).current;
  const isHidden = useRef(true);

  // Aparece con bounce al montar
  useEffect(() => {
    if (itemCount > 0 && prevCount.current === 0) {
      mountScale.setValue(0);
      isHidden.current = false;
      Animated.spring(mountScale, {
        toValue: 1,
        tension: 65,
        friction: 9,
        useNativeDriver: true,
      }).start();
    } else if (itemCount === 0) {
      Animated.spring(mountScale, {
        toValue: 0,
        tension: 200,
        friction: 15,
        useNativeDriver: true,
      }).start(() => {
        isHidden.current = true;
      });
    }
    prevCount.current = itemCount;
  }, [itemCount]);

  // Bounce al agregar items
  useEffect(() => {
    if (itemCount > 0) {
      Animated.sequence([
        Animated.spring(bounceAnim, {
          toValue: 1.08,
          tension: 300,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(bounceAnim, {
          toValue: 1,
          tension: 300,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [itemCount]);

  const onPressIn = () =>
    Animated.spring(pressScale, {
      toValue: 0.96,
      tension: 300,
      friction: 15,
      useNativeDriver: true,
    }).start();

  const onPressOut = () =>
    Animated.spring(pressScale, {
      toValue: 1,
      tension: 300,
      friction: 15,
      useNativeDriver: true,
    }).start();

  if (itemCount === 0 && isHidden.current) return null;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          transform: [
            {
              scale: Animated.multiply(
                mountScale,
                Animated.multiply(pressScale, bounceAnim),
              ),
            },
          ],
        },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        <LinearGradient
          colors={[COLORS.gradientStart, COLORS.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.button}
        >
          {/* Badge cantidad */}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{itemCount}</Text>
          </View>

          <Text style={styles.label}>Ver tu carrito</Text>

          <View style={styles.right}>
            <Text style={styles.total}>{formatPrice(total)}</Text>
            <Ionicons
              name="arrow-forward"
              size={16}
              color={COLORS.background}
              style={styles.arrow}
            />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 100,
    left: SPACING.lg,
    right: SPACING.lg,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
    borderRadius: BORDER_RADIUS.xl,
  },
  button: {
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: COLORS.background,
    width: 30,
    height: 30,
    borderRadius: BORDER_RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  badgeText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  label: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.background,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  total: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.background,
  },
  arrow: {
    marginLeft: SPACING.xs,
  },
});
