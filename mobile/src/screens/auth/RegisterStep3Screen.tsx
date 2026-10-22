import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { api } from '../../services/api/apiClient';
import { useAuthStore } from '../../store';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
} from '../../constants';
import { useModulo, useNombreApp } from '../../config/hooks';
import { RootStackParamList } from '../../navigation/types';
import { showAlert } from '../../utils/alert';

// ── Tipos ──────────────────────────────────────────────────────────

type RegisterStep3NavigationProp =
  NativeStackNavigationProp<RootStackParamList>;
type RegisterStep3RouteProp = RouteProp<RootStackParamList, 'RegisterStep3'>;

interface RegisterStep3ScreenProps {
  navigation: RegisterStep3NavigationProp;
  route: RegisterStep3RouteProp;
}

type ConocimientoOption = 'consumed' | 'known_not_consumed' | 'first_time';
type HowFoundUsOption =
  | 'amigo'
  | 'redes_sociales'
  | 'socio_club'
  | 'pase_por_lugar'
  | 'evento'
  | 'otro';

interface ConocimientoCard {
  key: ConocimientoOption;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}

interface HowFoundUsChip {
  key: HowFoundUsOption;
  label: string;
}

// ── Datos ──────────────────────────────────────────────────────────

const OPCIONES_CONOCIMIENTO: ConocimientoCard[] = [
  {
    key: 'consumed',
    label: 'Si, ya he consumido aqui',
    icon: 'restaurant-outline',
    description: 'Ya conozco el menu',
  },
  {
    key: 'known_not_consumed',
    label: 'Si, pero nunca he consumido',
    icon: 'eye-outline',
    description: 'Lo conozco de referencia',
  },
  {
    key: 'first_time',
    label: 'No, es la primera vez',
    icon: 'sparkles-outline',
    description: 'Es mi primera experiencia',
  },
];

const HOW_FOUND_US_OPTIONS: HowFoundUsChip[] = [
  { key: 'amigo', label: 'Amigo/familiar' },
  { key: 'redes_sociales', label: 'Redes sociales' },
  { key: 'socio_club', label: 'Soy socio del club' },
  { key: 'pase_por_lugar', label: 'Pase por el lugar' },
  { key: 'evento', label: 'Evento/fiesta' },
  { key: 'otro', label: 'Otro' },
];

// ── Pantalla Principal ─────────────────────────────────────────────

export const RegisterStep3Screen: React.FC<RegisterStep3ScreenProps> = ({
  navigation,
  route,
}) => {
  const isMember = (route.params as { isMember?: boolean })?.isMember ?? false;
  const associateNumber = (route.params as { associateNumber?: string })
    ?.associateNumber;
  const incomeRange = (route.params as { incomeRange?: string })?.incomeRange;

  const nombre = useNombreApp();
  const socios = useModulo('partners');

  // ── State ──
  const [conocimiento, setConocimiento] = useState<ConocimientoOption | null>(
    null,
  );
  const [howFoundUs, setHowFoundUs] = useState<HowFoundUsOption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mostrar "como nos conociste" solo si respondio que si conoce el lugar
  const showHowFoundUs =
    conocimiento === 'consumed' || conocimiento === 'known_not_consumed';

  // ── Animaciones ──
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerY = useRef(new Animated.Value(-24)).current;
  const formY = useRef(new Animated.Value(28)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const blobFloat1 = useRef(new Animated.Value(0)).current;
  const blobFloat2 = useRef(new Animated.Value(0)).current;
  const howFoundUsOpacity = useRef(new Animated.Value(0)).current;
  const howFoundUsHeight = useRef(new Animated.Value(0)).current;

  // ── Blobs flotantes ──
  useEffect(() => {
    const createBlobLoop = (anim: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 8,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: -8,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
    const loop1 = createBlobLoop(blobFloat1, 5000);
    const loop2 = createBlobLoop(blobFloat2, 4500);
    loop1.start();
    loop2.start();
    return () => {
      loop1.stop();
      loop2.stop();
    };
  }, [blobFloat1, blobFloat2]);

  // ── Entrada animada ──
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(headerY, {
        toValue: 0,
        tension: 60,
        friction: 11,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(130),
        Animated.spring(formY, {
          toValue: 0,
          tension: 60,
          friction: 11,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [fadeAnim, headerY, formY]);

  // ── Animar seccion "como nos conociste" ──
  useEffect(() => {
    const show = showHowFoundUs;
    Animated.parallel([
      Animated.timing(howFoundUsHeight, {
        toValue: show ? 1 : 0,
        duration: show ? 300 : 220,
        easing: show ? Easing.out(Easing.ease) : Easing.in(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.timing(howFoundUsOpacity, {
        toValue: show ? 1 : 0,
        duration: show ? 280 : 180,
        easing: show ? Easing.out(Easing.ease) : Easing.in(Easing.ease),
        useNativeDriver: false,
      }),
    ]).start();

    // Limpiar seleccion si cambia a "primera vez"
    if (!show) {
      setHowFoundUs(null);
    }
  }, [showHowFoundUs, howFoundUsHeight, howFoundUsOpacity]);

  // ── Handle card select ──
  const handleConocimientoSelect = useCallback((option: ConocimientoOption) => {
    setConocimiento((prev) => (prev === option ? null : option));
  }, []);

  // ── Skip ──
  const handleSkip = useCallback(() => {
    navigation.navigate('RegisterStep4', {
      isMember,
      associateNumber,
      incomeRange,
    });
  }, [navigation, isMember, associateNumber, incomeRange]);

  // ── Submit ──
  const handleContinue = useCallback(async () => {
    setIsSubmitting(true);

    try {
      const uid = useAuthStore.getState().user?.id;
      if (!uid) {
        showAlert('Error', 'Sesion no encontrada. Intenta de nuevo.');
        return;
      }

      const updateData: Record<string, string | null> = {};
      if (conocimiento) {
        updateData.knowsBusiness = conocimiento;
      }
      if (howFoundUs) {
        updateData.howFoundUs = howFoundUs;
      }

      await api.patch(`/api/customers/${uid}`, updateData);

      navigation.navigate('RegisterStep4', {
        isMember,
        associateNumber,
        incomeRange,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al guardar los datos';
      showAlert('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    conocimiento,
    howFoundUs,
    isMember,
    associateNumber,
    incomeRange,
    navigation,
  ]);

  // ── Button press animation ──
  const onButtonPressIn = useCallback(() => {
    Animated.spring(buttonScale, {
      toValue: 0.96,
      tension: 300,
      friction: 20,
      useNativeDriver: true,
    }).start();
  }, [buttonScale]);

  const onButtonPressOut = useCallback(() => {
    Animated.spring(buttonScale, {
      toValue: 1,
      tension: 300,
      friction: 20,
      useNativeDriver: true,
    }).start();
  }, [buttonScale]);

  // ── Render ──
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

      <ScrollView
        style={styles.keyboardView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
      >
        {/* ── Header ── */}
        <Animated.View
          style={[
            styles.header,
            { opacity: fadeAnim, transform: [{ translateY: headerY }] },
          ]}
        >
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              {/* Step indicator */}
              <View style={styles.stepIndicator}>
                <LinearGradient
                  colors={[COLORS.gradientStart, COLORS.gradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.stepBadge}
                >
                  <Text style={styles.stepBadgeText}>Paso 3 de 5</Text>
                </LinearGradient>
              </View>
              <Text style={styles.title}>Nos conocias?</Text>
              <Text style={styles.subtitle}>
                Queremos saber como llegaste a nosotros
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleSkip}
              style={styles.skipButton}
              activeOpacity={0.7}
            >
              <Text style={styles.skipText}>Omitir</Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── Form card ── */}
        <Animated.View
          style={[
            styles.formCard,
            { opacity: fadeAnim, transform: [{ translateY: formY }] },
          ]}
        >
          {/* ── Pregunta 1: ¿Conoces el lugar? ── */}
          <View style={styles.sectionHeader}>
            <Ionicons
              name="help-circle-outline"
              size={18}
              color={COLORS.primary}
            />
            <Text style={styles.sectionTitle}>¿Conoces {nombre}?</Text>
          </View>

          <View style={styles.cardsContainer}>
            {OPCIONES_CONOCIMIENTO.map((option) => {
              const isSelected = conocimiento === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.optionCard,
                    isSelected && styles.optionCardSelected,
                  ]}
                  onPress={() => handleConocimientoSelect(option.key)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.optionCardIconWrapper,
                      isSelected && styles.optionCardIconWrapperSelected,
                    ]}
                  >
                    <Ionicons
                      name={option.icon}
                      size={28}
                      color={isSelected ? COLORS.background : COLORS.primary}
                    />
                  </View>
                  <View style={styles.optionCardContent}>
                    <Text
                      style={[
                        styles.optionCardLabel,
                        isSelected && styles.optionCardLabelSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text
                      style={[
                        styles.optionCardDescription,
                        isSelected && styles.optionCardDescriptionSelected,
                      ]}
                    >
                      {option.description}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={styles.optionCardCheck}>
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color={COLORS.primary}
                      />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Pregunta 2: Como nos conociste? (animada) ── */}
          <Animated.View
            style={{
              opacity: howFoundUsOpacity,
              maxHeight: howFoundUsHeight.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 300],
              }),
              overflow: 'hidden',
            }}
          >
            <View style={[styles.sectionHeader, { marginTop: SPACING.xl }]}>
              <Ionicons
                name="compass-outline"
                size={18}
                color={COLORS.primary}
              />
              <Text style={styles.sectionTitle}>Como nos conociste?</Text>
            </View>

            <View style={styles.chipsContainer}>
              {HOW_FOUND_US_OPTIONS.filter(
                (option) => socios || option.key !== 'socio_club',
              ).map((option) => {
                const isSelected = howFoundUs === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() =>
                      setHowFoundUs(isSelected ? null : option.key)
                    }
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isSelected && styles.chipTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>

          {/* ── Boton Continuar ── */}
          <Animated.View
            style={[
              styles.continueButtonWrapper,
              { transform: [{ scale: buttonScale }] },
            ]}
          >
            <TouchableOpacity
              onPress={handleContinue}
              onPressIn={onButtonPressIn}
              onPressOut={onButtonPressOut}
              disabled={isSubmitting}
              activeOpacity={1}
            >
              <LinearGradient
                colors={
                  isSubmitting
                    ? [COLORS.textLight, COLORS.textLight]
                    : [COLORS.gradientStart, COLORS.gradientEnd]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.continueButton}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={COLORS.textWhite} />
                ) : (
                  <>
                    <Text style={styles.continueButtonText}>Continuar</Text>
                    <Ionicons
                      name="arrow-forward"
                      size={20}
                      color={COLORS.textWhite}
                    />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* ── Progress dots ── */}
          <View style={styles.progressDots}>
            <View style={styles.dotCompleted} />
            <View style={styles.dotCompleted} />
            <View style={styles.dotActive} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ── Estilos ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },

  blobTopRight: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: COLORS.primary,
    opacity: 0.06,
  },
  blobBottomLeft: {
    position: 'absolute',
    bottom: -60,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: COLORS.primaryDark,
    opacity: 0.05,
  },

  header: { paddingTop: SPACING.md, marginBottom: SPACING.xl },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stepIndicator: { marginBottom: SPACING.md },
  stepBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  stepBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.background,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  skipText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
  },

  formCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    borderColor: `${COLORS.primary}20`,
    padding: SPACING.xxl,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
  },

  // Cards de opciones (Pregunta 1)
  cardsContainer: { gap: SPACING.md },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(28,25,23,0.85)',
    gap: SPACING.md,
  },
  optionCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}10`,
  },
  optionCardIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionCardIconWrapperSelected: {
    backgroundColor: COLORS.primary,
  },
  optionCardContent: { flex: 1 },
  optionCardLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    marginBottom: 2,
  },
  optionCardLabelSelected: { color: COLORS.primary },
  optionCardDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  optionCardDescriptionSelected: { color: COLORS.textSecondary },
  optionCardCheck: { marginLeft: SPACING.xs },

  // Chips (Pregunta 2)
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(28,25,23,0.85)',
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
  },
  chipTextSelected: { color: COLORS.background, fontWeight: FONT_WEIGHT.bold },

  // Boton
  continueButtonWrapper: {
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.xxl,
  },
  continueButton: {
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.lg + 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  continueButtonText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textWhite,
    letterSpacing: 0.5,
  },

  // Progress dots
  progressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xl,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  dotActive: {
    width: 24,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  dotCompleted: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
});
