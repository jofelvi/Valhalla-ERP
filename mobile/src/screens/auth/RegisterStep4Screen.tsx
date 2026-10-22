import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../services/api/apiClient';
import { useAuthStore } from '../../store';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
} from '../../constants';
import { showAlert } from '../../utils/alert';

// ─── Types ────────────────────────────────────────────────────────

interface RouteParams {
  isMember?: boolean;
  associateNumber?: string;
  incomeRange?: string;
}

interface RegisterStep4ScreenProps {
  navigation: {
    navigate: (screen: string, params?: RouteParams) => void;
    goBack: () => void;
  };
  route: {
    params?: RouteParams;
  };
}

interface SpendingOption {
  id: string;
  emoji: string;
  label: string;
}

interface FrequencyOption {
  id: string;
  label: string;
  description: string;
}

interface ConsumptionOption {
  id: string;
  emoji: string;
  label: string;
}

// ─── Data ─────────────────────────────────────────────────────────

const SPENDING_OPTIONS: SpendingOption[] = [
  {
    id: 'food_restaurants',
    emoji: '\uD83C\uDF54',
    label: 'Comida y restaurantes',
  },
  { id: 'supermarket', emoji: '\uD83D\uDED2', label: 'Supermercado' },
  { id: 'clothing', emoji: '\uD83D\uDC57', label: 'Ropa y calzado' },
  { id: 'technology', emoji: '\uD83D\uDCF1', label: 'Tecnolog\u00eda' },
  { id: 'health', emoji: '\uD83C\uDFE5', label: 'Salud y farmacia' },
  { id: 'education', emoji: '\uD83C\uDF93', label: 'Educaci\u00f3n' },
  { id: 'transport', emoji: '\uD83D\uDE97', label: 'Transporte' },
  { id: 'home', emoji: '\uD83C\uDFE0', label: 'Hogar y servicios' },
  { id: 'entertainment', emoji: '\uD83C\uDF89', label: 'Entretenimiento' },
  { id: 'sports', emoji: '\uD83D\uDCAA', label: 'Deportes y fitness' },
];

const FREQUENCY_OPTIONS: FrequencyOption[] = [
  {
    id: 'first_time',
    label: 'Primera vez',
    description: 'Es mi primera visita',
  },
  {
    id: 'occasional',
    label: 'Ocasionalmente',
    description: '1-2 veces al mes',
  },
  { id: 'frequent', label: 'Frecuente', description: '1 vez por semana' },
  {
    id: 'very_frequent',
    label: 'Muy frecuente',
    description: '2+ veces por semana',
  },
];

const CONSUMPTION_OPTIONS: ConsumptionOption[] = [
  { id: 'pizzas_pastas', emoji: '\uD83C\uDF55', label: 'Pizzas y pastas' },
  { id: 'burgers_hotdogs', emoji: '\uD83C\uDF54', label: 'Burgers y hot dogs' },
  { id: 'grill_meats', emoji: '\uD83E\uDD69', label: 'Parrilla y carnes' },
  { id: 'beers', emoji: '\uD83C\uDF7A', label: 'Cervezas' },
  { id: 'cocktails', emoji: '\uD83C\uDF79', label: 'C\u00f3cteles y tragos' },
  { id: 'soft_drinks', emoji: '\uD83E\uDD64', label: 'Refrescos y jugos' },
  { id: 'events', emoji: '\uD83C\uDF82', label: 'Eventos y fiestas' },
];

// ─── Component ────────────────────────────────────────────────────

export const RegisterStep4Screen: React.FC<RegisterStep4ScreenProps> = ({
  navigation,
  route,
}) => {
  const params = route.params ?? {};

  const [selectedSpending, setSelectedSpending] = useState<string[]>([]);
  const [selectedFrequency, setSelectedFrequency] = useState<string | null>(
    null,
  );
  const [selectedConsumption, setSelectedConsumption] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // ─── Animations ───────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerY = useRef(new Animated.Value(-20)).current;
  const sectionAnims = useRef(
    [0, 1, 2].map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(24),
    })),
  ).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  // Blobs flotantes
  const blobFloat1 = useRef(new Animated.Value(0)).current;
  const blobFloat2 = useRef(new Animated.Value(0)).current;

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
      Animated.stagger(
        150,
        sectionAnims.map((section) =>
          Animated.parallel([
            Animated.timing(section.opacity, {
              toValue: 1,
              duration: 400,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.spring(section.translateY, {
              toValue: 0,
              tension: 60,
              friction: 12,
              useNativeDriver: true,
            }),
          ]),
        ),
      ),
    ]).start();
  }, [fadeAnim, headerY, sectionAnims]);

  // ─── Handlers ─────────────────────────────────────────────────
  const toggleSpending = (id: string) => {
    setSelectedSpending((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const toggleConsumption = (id: string) => {
    setSelectedConsumption((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const navigateToStep5 = () => {
    navigation.navigate('RegisterStep5', {
      isMember: params.isMember,
      associateNumber: params.associateNumber,
      incomeRange: params.incomeRange,
    });
  };

  const handleContinue = async () => {
    const uid = useAuthStore.getState().user?.id;
    if (!uid) {
      showAlert(
        'Error',
        'No se encontr\u00f3 tu sesi\u00f3n. Intenta de nuevo.',
      );
      return;
    }

    setIsSaving(true);
    try {
      const preferencesData: Record<string, string[] | string | null> = {};

      if (selectedSpending.length > 0) {
        preferencesData.spendingCategories = selectedSpending;
      }
      if (selectedFrequency) {
        preferencesData.visitFrequency = selectedFrequency;
      }
      if (selectedConsumption.length > 0) {
        preferencesData.consumptionPreferences = selectedConsumption;
      }

      if (Object.keys(preferencesData).length > 0) {
        await api.patch(`/api/customers/${uid}`, preferencesData);
      }

      navigateToStep5();
    } catch (error) {
      console.error('Error guardando preferencias:', error);
      showAlert(
        'Error',
        'No se pudieron guardar las preferencias. Intenta de nuevo.',
      );
    } finally {
      setIsSaving(false);
    }
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

  const hasSelections =
    selectedSpending.length > 0 ||
    selectedFrequency !== null ||
    selectedConsumption.length > 0;

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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: headerY }],
            },
          ]}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={22} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={navigateToStep5} activeOpacity={0.7}>
              <Text style={styles.skipText}>Omitir</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>Tus preferencias</Text>
          <Text style={styles.stepIndicator}>Paso 4 de 5</Text>

          {/* Progress bar */}
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBg}>
              <LinearGradient
                colors={[COLORS.gradientStart, COLORS.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressBarFill, { width: '80%' }]}
              />
            </View>
          </View>
        </Animated.View>

        {/* Section 1: Spending */}
        <Animated.View
          style={[
            styles.section,
            {
              opacity: sectionAnims[0].opacity,
              transform: [{ translateY: sectionAnims[0].translateY }],
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Ionicons name="wallet-outline" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>
              \u00bfEn qu\u00e9 gastas normalmente?
            </Text>
          </View>
          <View style={styles.chipsContainer}>
            {SPENDING_OPTIONS.map((option) => {
              const isSelected = selectedSpending.includes(option.id);
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => toggleSpending(option.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chipEmoji}>{option.emoji}</Text>
                  <Text
                    style={[
                      styles.chipLabel,
                      isSelected && styles.chipLabelSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={COLORS.background}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        {/* Section 2: Visit frequency */}
        <Animated.View
          style={[
            styles.section,
            {
              opacity: sectionAnims[1].opacity,
              transform: [{ translateY: sectionAnims[1].translateY }],
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Ionicons
              name="calendar-outline"
              size={20}
              color={COLORS.primary}
            />
            <Text style={styles.sectionTitle}>
              \u00bfCon qu\u00e9 frecuencia visitas el club?
            </Text>
          </View>
          <View style={styles.frequencyContainer}>
            {FREQUENCY_OPTIONS.map((option) => {
              const isSelected = selectedFrequency === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.frequencyCard,
                    isSelected && styles.frequencyCardSelected,
                  ]}
                  onPress={() => setSelectedFrequency(option.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.frequencyContent}>
                    <View
                      style={[
                        styles.radioOuter,
                        isSelected && styles.radioOuterSelected,
                      ]}
                    >
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <View style={styles.frequencyTextContainer}>
                      <Text
                        style={[
                          styles.frequencyLabel,
                          isSelected && styles.frequencyLabelSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                      <Text style={styles.frequencyDescription}>
                        {option.description}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        {/* Section 3: Consumption preferences */}
        <Animated.View
          style={[
            styles.section,
            {
              opacity: sectionAnims[2].opacity,
              transform: [{ translateY: sectionAnims[2].translateY }],
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Ionicons
              name="restaurant-outline"
              size={20}
              color={COLORS.primary}
            />
            <Text style={styles.sectionTitle}>
              \u00bfQu\u00e9 prefieres consumir aqu\u00ed?
            </Text>
          </View>
          <View style={styles.chipsContainer}>
            {CONSUMPTION_OPTIONS.map((option) => {
              const isSelected = selectedConsumption.includes(option.id);
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => toggleConsumption(option.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chipEmoji}>{option.emoji}</Text>
                  <Text
                    style={[
                      styles.chipLabel,
                      isSelected && styles.chipLabelSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={COLORS.background}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        {/* Continue button */}
        <View style={styles.buttonContainer}>
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
              disabled={isSaving}
              activeOpacity={1}
            >
              <LinearGradient
                colors={
                  isSaving
                    ? [COLORS.textLight, COLORS.textLight]
                    : [COLORS.gradientStart, COLORS.gradientEnd]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.continueButton}
              >
                {isSaving ? (
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

          {hasSelections && (
            <Text style={styles.selectionHint}>
              {selectedSpending.length + selectedConsumption.length}{' '}
              categor\u00edas seleccionadas
              {selectedFrequency ? ' \u00b7 frecuencia elegida' : ''}
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxxl + 16,
  },

  // Blobs
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

  // Header
  header: {
    paddingTop: SPACING.md,
    marginBottom: SPACING.xl,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  skipText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.semibold,
  },
  title: {
    fontSize: FONT_SIZE.title,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
    letterSpacing: 0.3,
  },
  stepIndicator: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },

  // Progress bar
  progressBarContainer: {
    marginTop: SPACING.xs,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: BORDER_RADIUS.full,
  },

  // Sections
  section: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    borderColor: `${COLORS.primary}20`,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    flex: 1,
  },

  // Chips (multi-select)
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
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
  chipEmoji: {
    fontSize: FONT_SIZE.md,
  },
  chipLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
  },
  chipLabelSelected: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHT.bold,
  },

  // Frequency (single select cards)
  frequencyContainer: {
    gap: SPACING.sm,
  },
  frequencyCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(28,25,23,0.85)',
    padding: SPACING.lg,
  },
  frequencyCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}15`,
  },
  frequencyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: COLORS.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  frequencyTextContainer: {
    flex: 1,
  },
  frequencyLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    marginBottom: 2,
  },
  frequencyLabelSelected: {
    color: COLORS.primary,
  },
  frequencyDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },

  // Button
  buttonContainer: {
    marginTop: SPACING.lg,
    alignItems: 'center',
  },
  continueButtonWrapper: {
    width: '100%',
    borderRadius: BORDER_RADIUS.lg,
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
  selectionHint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
});
