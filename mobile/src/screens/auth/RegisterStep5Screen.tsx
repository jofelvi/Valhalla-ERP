import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import { api } from '../../services/api/apiClient';
import { useAuthStore } from '../../store';
import { calculateCreditLimit } from '../../services/memberValidationService';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
} from '../../constants';
import { useNombreApp } from '../../config/hooks';
import { API_URL } from '../../config/env';

// ─── Types ────────────────────────────────────────────────────────

interface RouteParams {
  isMember?: boolean;
  associateNumber?: string;
  incomeRange?: string;
}

interface NavigationProp {
  dispatch: (action: ReturnType<typeof CommonActions.reset>) => void;
  goBack: () => void;
}

interface RegisterStep5ScreenProps {
  navigation: NavigationProp;
  route: {
    params?: RouteParams;
  };
}

interface CustomerData {
  name?: string;
  email?: string;
}

// ─── Component ────────────────────────────────────────────────────

export const RegisterStep5Screen: React.FC<RegisterStep5ScreenProps> = ({
  navigation,
  route,
}) => {
  const params = route.params ?? {};
  const { isMember, incomeRange } = params;
  const nombre = useNombreApp();

  const [isLoading, setIsLoading] = useState(true);
  const [creditLimit, setCreditLimit] = useState(0);
  const hasMemberCredit = Boolean(isMember && incomeRange);

  // ─── Animations ───────────────────────────────────────────────
  const checkScaleAnim = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.3)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(20)).current;
  const creditOpacity = useRef(new Animated.Value(0)).current;
  const creditScale = useRef(new Animated.Value(0.8)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleY = useRef(new Animated.Value(16)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonY = useRef(new Animated.Value(24)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  // Blobs flotantes
  const blobFloat1 = useRef(new Animated.Value(0)).current;
  const blobFloat2 = useRef(new Animated.Value(0)).current;

  // Confetti-like particles
  const particles = useRef(
    Array.from({ length: 6 }, () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(0),
      translateX: new Animated.Value(0),
      scale: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    const createBlobLoop = (anim: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 10,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: -10,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
    const loop1 = createBlobLoop(blobFloat1, 4500);
    const loop2 = createBlobLoop(blobFloat2, 5500);
    loop1.start();
    loop2.start();
    return () => {
      loop1.stop();
      loop2.stop();
    };
  }, [blobFloat1, blobFloat2]);

  // ─── Save data & trigger animations ───────────────────────────
  useEffect(() => {
    const saveAndAnimate = async () => {
      const user = useAuthStore.getState().user;
      const uid = user?.id;
      if (!uid) {
        setIsLoading(false);
        return;
      }

      try {
        // Calculate credit
        let calculatedCredit = 0;
        if (hasMemberCredit && incomeRange) {
          calculatedCredit = calculateCreditLimit(incomeRange);
        }
        setCreditLimit(calculatedCredit);

        // Determine profileComplete: true if member (completed step 2+), false otherwise
        const profileComplete = Boolean(isMember);

        // Save to backend
        await api.patch(`/api/customers/${uid}`, {
          creditLimit: calculatedCredit,
          profileComplete,
        });

        // Send welcome email (non-blocking)
        if (calculatedCredit > 0) {
          const customerName = user.name ?? '';
          const customerEmail = user.email ?? '';

          // Endpoint de la API del ambiente. Exige rol de staff: para un cliente falla en
          // silencio (no bloqueante). Pendiente decidir quién manda el correo de bienvenida.
          fetch(`${API_URL}/api/notifications/email/welcome`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerId: uid,
              name: customerName,
              email: customerEmail,
              creditLimit: calculatedCredit,
            }),
          }).catch(() => {
            // Non-blocking: silently ignore email failures
          });
        }
      } catch (error) {
        console.error('Error guardando datos finales:', error);
      } finally {
        setIsLoading(false);
      }
    };

    saveAndAnimate();
  }, [hasMemberCredit, incomeRange, isMember]);

  // Celebration animation sequence (after loading completes)
  useEffect(() => {
    if (isLoading) return;

    // Glow pulse loop
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );

    Animated.sequence([
      // 1. Checkmark appears with bounce
      Animated.parallel([
        Animated.spring(checkScaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(checkOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),

      // 2. Particles burst
      Animated.parallel(
        particles.map((particle, index) => {
          const angle = (index / particles.length) * 2 * Math.PI;
          const radius = 60 + Math.random() * 30;
          return Animated.parallel([
            Animated.timing(particle.opacity, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(particle.scale, {
              toValue: 1,
              duration: 300,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(particle.translateX, {
              toValue: Math.cos(angle) * radius,
              duration: 500,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(particle.translateY, {
                toValue: Math.sin(angle) * radius,
                duration: 500,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(particle.opacity, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
              }),
            ]),
          ]);
        }),
      ),

      // 3. Title
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(titleY, {
          toValue: 0,
          tension: 60,
          friction: 11,
          useNativeDriver: true,
        }),
      ]),

      // 4. Credit amount (if applicable) or subtitle
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(creditOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(creditScale, {
          toValue: 1,
          tension: 55,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),

      // 5. Subtitle
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(subtitleY, {
          toValue: 0,
          tension: 60,
          friction: 11,
          useNativeDriver: true,
        }),
      ]),

      // 6. Button
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(buttonY, {
          toValue: 0,
          tension: 60,
          friction: 11,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    glowLoop.start();
    return () => {
      glowLoop.stop();
    };
  }, [
    isLoading,
    checkScaleAnim,
    checkOpacity,
    glowPulse,
    titleOpacity,
    titleY,
    creditOpacity,
    creditScale,
    subtitleOpacity,
    subtitleY,
    buttonOpacity,
    buttonY,
    particles,
  ]);

  // ─── Handlers ─────────────────────────────────────────────────
  const handleExplore = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      }),
    );
  };

  const onButtonPressIn = () =>
    Animated.spring(buttonScale, {
      toValue: 0.96,
      tension: 300,
      friction: 20,
      useNativeDriver: true,
    }).start();

  const onButtonPressOut = () =>
    Animated.spring(buttonScale, {
      toValue: 1,
      tension: 300,
      friction: 20,
      useNativeDriver: true,
    }).start();

  // ─── Loading state ────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Preparando tu cuenta...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Particle colors ─────────────────────────────────────────
  const particleColors = [
    COLORS.primary,
    COLORS.primaryLight,
    COLORS.success,
    COLORS.primaryDark,
    COLORS.warning,
    COLORS.primary,
  ];

  // ─── Render ───────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {/* Blobs decorativos */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Animated.View
          style={[
            styles.blobTopRight,
            { transform: [{ translateY: blobFloat1 }] },
          ]}
        />
        <Animated.View
          style={[
            styles.blobBottomLeft,
            { transform: [{ translateY: blobFloat2 }] },
          ]}
        />
      </View>

      <View style={styles.content}>
        {/* Celebration area */}
        <View style={styles.celebrationArea}>
          {/* Glow behind icon */}
          <Animated.View style={[styles.glowCircle, { opacity: glowPulse }]} />

          {/* Particles */}
          {particles.map((particle, index) => (
            <Animated.View
              key={index}
              style={[
                styles.particle,
                {
                  backgroundColor: particleColors[index],
                  opacity: particle.opacity,
                  transform: [
                    { translateX: particle.translateX },
                    { translateY: particle.translateY },
                    { scale: particle.scale },
                  ],
                },
              ]}
            />
          ))}

          {/* Checkmark icon */}
          <Animated.View
            style={[
              styles.checkContainer,
              {
                opacity: checkOpacity,
                transform: [{ scale: checkScaleAnim }],
              },
            ]}
          >
            <LinearGradient
              colors={
                hasMemberCredit
                  ? [COLORS.gradientStart, COLORS.gradientEnd]
                  : [COLORS.success, COLORS.successLight]
              }
              style={styles.checkGradient}
            >
              <Ionicons
                name={hasMemberCredit ? 'star' : 'checkmark-circle'}
                size={64}
                color={COLORS.textWhite}
              />
            </LinearGradient>
          </Animated.View>
        </View>

        {/* Title */}
        <Animated.View
          style={{
            opacity: titleOpacity,
            transform: [{ translateY: titleY }],
          }}
        >
          <Text style={styles.title}>
            {hasMemberCredit
              ? '\u00a1Bienvenido, socio!'
              : `\u00a1Bienvenido a ${nombre}!`}
          </Text>
        </Animated.View>

        {/* Credit amount (member only) */}
        {hasMemberCredit && creditLimit > 0 ? (
          <Animated.View
            style={[
              styles.creditContainer,
              {
                opacity: creditOpacity,
                transform: [{ scale: creditScale }],
              },
            ]}
          >
            <View style={styles.creditBadge}>
              <LinearGradient
                colors={[`${COLORS.primary}25`, `${COLORS.primary}08`]}
                style={styles.creditBadgeGradient}
              >
                <Ionicons name="wallet" size={22} color={COLORS.primary} />
                <Text style={styles.creditAmount}>
                  ${creditLimit} disponibles
                </Text>
              </LinearGradient>
            </View>
          </Animated.View>
        ) : null}

        {/* Subtitle */}
        <Animated.View
          style={{
            opacity: subtitleOpacity,
            transform: [{ translateY: subtitleY }],
          }}
        >
          <Text style={styles.subtitle}>
            {hasMemberCredit && creditLimit > 0
              ? 'Tu cr\u00e9dito ha sido activado. \u00dasalo en tu pr\u00f3xima visita.'
              : 'Explora nuestro men\u00fa y haz tu primer pedido'}
          </Text>
        </Animated.View>

        {/* Features preview */}
        <Animated.View
          style={[
            styles.featuresContainer,
            {
              opacity: subtitleOpacity,
              transform: [{ translateY: subtitleY }],
            },
          ]}
        >
          <FeatureItem
            icon="restaurant-outline"
            text="Men\u00fa completo del restaurante"
          />
          <FeatureItem icon="cart-outline" text="Haz pedidos desde tu mesa" />
          <FeatureItem
            icon="notifications-outline"
            text="Notificaciones de tus pedidos"
          />
          {hasMemberCredit && (
            <FeatureItem
              icon="card-outline"
              text="Paga con tu cr\u00e9dito de socio"
            />
          )}
        </Animated.View>

        {/* Button */}
        <Animated.View
          style={[
            styles.buttonArea,
            {
              opacity: buttonOpacity,
              transform: [{ translateY: buttonY }],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.exploreButtonWrapper,
              { transform: [{ scale: buttonScale }] },
            ]}
          >
            <TouchableOpacity
              onPress={handleExplore}
              onPressIn={onButtonPressIn}
              onPressOut={onButtonPressOut}
              activeOpacity={1}
            >
              <LinearGradient
                colors={[COLORS.gradientStart, COLORS.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.exploreButton}
              >
                <Ionicons
                  name="rocket-outline"
                  size={22}
                  color={COLORS.textWhite}
                />
                <Text style={styles.exploreButtonText}>Empezar a explorar</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

// ─── Feature Item Component ─────────────────────────────────────

interface FeatureItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ icon, text }) => (
  <View style={featureStyles.container}>
    <View style={featureStyles.iconBg}>
      <Ionicons name={icon} size={18} color={COLORS.primary} />
    </View>
    <Text style={featureStyles.text}>{text}</Text>
  </View>
);

const featureStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  iconBg: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    flex: 1,
  },
});

// ─── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  loadingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },

  // Blobs
  blobTopRight: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: COLORS.primary,
    opacity: 0.06,
  },
  blobBottomLeft: {
    position: 'absolute',
    bottom: -60,
    left: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: COLORS.primaryDark,
    opacity: 0.05,
  },

  // Celebration
  celebrationArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xxl,
    height: 160,
    width: 160,
  },
  glowCircle: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: COLORS.primary,
  },
  particle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  checkContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
  },
  checkGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Text
  title: {
    fontSize: FONT_SIZE.title,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    letterSpacing: 0.3,
  },

  // Credit
  creditContainer: {
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  creditBadge: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: `${COLORS.primary}40`,
    overflow: 'hidden',
  },
  creditBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
  },
  creditAmount: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
    letterSpacing: 0.5,
  },

  // Subtitle
  subtitle: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
  },

  // Features
  featuresContainer: {
    width: '100%',
    gap: SPACING.md,
    marginBottom: SPACING.xxxl,
    paddingHorizontal: SPACING.md,
  },

  // Button
  buttonArea: {
    width: '100%',
  },
  exploreButtonWrapper: {
    borderRadius: BORDER_RADIUS.lg,
  },
  exploreButton: {
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.lg + 4,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  exploreButtonText: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textWhite,
    letterSpacing: 0.5,
  },
});
