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
  Keyboard,
  type TextInput as TextInputType,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { api } from '../../services/api/apiClient';
import { useAuthStore } from '../../store';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
} from '../../constants';
import { RootStackParamList } from '../../navigation/types';
import { showAlert } from '../../utils/alert';

// ── Tipos ──────────────────────────────────────────────────────────

type RegisterStep2NavigationProp =
  NativeStackNavigationProp<RootStackParamList>;
type RegisterStep2RouteProp = RouteProp<RootStackParamList, 'RegisterStep2'>;

interface RegisterStep2ScreenProps {
  navigation: RegisterStep2NavigationProp;
  route: RegisterStep2RouteProp;
}

interface ProfessionOption {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface IncomeOption {
  key: string;
  label: string;
}

// ── Datos ──────────────────────────────────────────────────────────

const PROFESSION_OPTIONS: ProfessionOption[] = [
  { key: 'comerciante', label: 'Comerciante', icon: 'storefront-outline' },
  { key: 'empleado', label: 'Empleado', icon: 'briefcase-outline' },
  { key: 'independiente', label: 'Independiente', icon: 'rocket-outline' },
  { key: 'profesional', label: 'Profesional', icon: 'school-outline' },
  { key: 'jubilado', label: 'Jubilado', icon: 'heart-outline' },
  { key: 'estudiante', label: 'Estudiante', icon: 'book-outline' },
  { key: 'ama_de_casa', label: 'Ama de casa', icon: 'home-outline' },
  { key: 'otro', label: 'Otro', icon: 'ellipsis-horizontal-outline' },
];

const INCOME_OPTIONS: IncomeOption[] = [
  { key: 'menos_100', label: 'Menos de $100' },
  { key: '100_200', label: '$100 - $200' },
  { key: '200_300', label: '$200 - $300' },
  { key: '300_500', label: '$300 - $500' },
  { key: '500_800', label: '$500 - $800' },
  { key: '800_1200', label: '$800 - $1,200' },
  { key: '1200_2000', label: '$1,200 - $2,000' },
  { key: '2000_3500', label: '$2,000 - $3,500' },
  { key: 'mas_3500', label: 'Mas de $3,500' },
];

// ── Pantalla Principal ─────────────────────────────────────────────

export const RegisterStep2Screen: React.FC<RegisterStep2ScreenProps> = ({
  navigation,
  route,
}) => {
  const isMember = (route.params as { isMember?: boolean })?.isMember ?? false;
  const associateNumber = (route.params as { associateNumber?: string })
    ?.associateNumber;

  // ── State ──
  const [address, setAddress] = useState('');
  const [selectedProfession, setSelectedProfession] = useState<string | null>(
    null,
  );
  const [selectedIncome, setSelectedIncome] = useState<string | null>(null);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Refs ──
  const addressRef = useRef<TextInputType | null>(null);

  // ── Animaciones ──
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerY = useRef(new Animated.Value(-24)).current;
  const formY = useRef(new Animated.Value(28)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const blobFloat1 = useRef(new Animated.Value(0)).current;
  const blobFloat2 = useRef(new Animated.Value(0)).current;

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

  // ── Skip ──
  const handleSkip = useCallback(() => {
    navigation.navigate('RegisterStep5', {
      isMember,
      hasCredit: false,
    });
  }, [navigation, isMember]);

  // ── Submit ──
  const handleContinue = useCallback(async () => {
    Keyboard.dismiss();
    setIsSubmitting(true);

    try {
      const uid = useAuthStore.getState().user?.id;
      if (!uid) {
        showAlert('Error', 'Sesion no encontrada. Intenta de nuevo.');
        return;
      }

      const updateData: Record<string, string | null> = {};
      if (address.trim()) {
        updateData.address = address.trim();
      }
      if (selectedProfession) {
        updateData.profession = selectedProfession;
      }
      if (selectedIncome) {
        updateData.incomeRange = selectedIncome;
      }

      await api.patch(`/api/customers/${uid}`, updateData);

      navigation.navigate('RegisterStep3', {
        isMember,
        associateNumber: associateNumber ?? undefined,
        incomeRange: selectedIncome ?? undefined,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al guardar los datos';
      showAlert('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    address,
    selectedProfession,
    selectedIncome,
    isMember,
    associateNumber,
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
        keyboardDismissMode="none"
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
                  <Text style={styles.stepBadgeText}>Paso 2 de 5</Text>
                </LinearGradient>
              </View>
              <Text style={styles.title}>Cuentanos sobre ti</Text>
              <Text style={styles.subtitle}>
                Esta informacion nos ayuda a personalizar tu experiencia
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
          {/* ── Direccion ── */}
          <View style={styles.sectionHeader}>
            <Ionicons
              name="location-outline"
              size={18}
              color={COLORS.primary}
            />
            <Text style={styles.sectionTitle}>Direccion</Text>
          </View>
          <Input
            ref={addressRef}
            placeholder="Ej: Av. Principal, ciudad"
            value={address}
            onChangeText={setAddress}
            autoCapitalize="sentences"
            returnKeyType="done"
          />

          {/* ── Profesion ── */}
          <View style={[styles.sectionHeader, { marginTop: SPACING.lg }]}>
            <Ionicons
              name="briefcase-outline"
              size={18}
              color={COLORS.primary}
            />
            <Text style={styles.sectionTitle}>Profesion</Text>
          </View>
          <View style={styles.chipsContainer}>
            {PROFESSION_OPTIONS.map((option) => {
              const isSelected = selectedProfession === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() =>
                    setSelectedProfession(isSelected ? null : option.key)
                  }
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={option.icon}
                    size={16}
                    color={
                      isSelected ? COLORS.background : COLORS.textSecondary
                    }
                  />
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

          {/* ── Ingreso mensual ── */}
          <View style={[styles.sectionHeader, { marginTop: SPACING.lg }]}>
            <Ionicons name="wallet-outline" size={18} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Ingreso mensual</Text>
          </View>
          <View style={styles.incomeContainer}>
            {INCOME_OPTIONS.map((option) => {
              const isSelected = selectedIncome === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.incomeChip,
                    isSelected && styles.incomeChipSelected,
                  ]}
                  onPress={() =>
                    setSelectedIncome(isSelected ? null : option.key)
                  }
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.incomeChipText,
                      isSelected && styles.incomeChipTextSelected,
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

          {/* ── Boton Continuar ── */}
          <Animated.View
            style={[
              styles.continueButtonWrapper,
              { transform: [{ scale: buttonScale }] },
            ]}
          >
            <Button
              label="Continuar"
              variant="primary"
              size="lg"
              onPress={handleContinue}
              onPressIn={onButtonPressIn}
              onPressOut={onButtonPressOut}
              loading={isSubmitting}
              disabled={isSubmitting}
              icon={
                !isSubmitting ? (
                  <Ionicons
                    name="arrow-forward"
                    size={20}
                    color={COLORS.textWhite}
                  />
                ) : undefined
              }
              iconPosition="right"
            />
          </Animated.View>

          {/* ── Progress dots ── */}
          <View style={styles.progressDots}>
            <View style={styles.dotCompleted} />
            <View style={styles.dotActive} />
            <View style={styles.dot} />
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
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
  },

  // Chips de profesion
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
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
  chipText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
  },
  chipTextSelected: { color: COLORS.background, fontWeight: FONT_WEIGHT.bold },

  // Chips de ingreso
  incomeContainer: { gap: SPACING.sm },
  incomeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md + 2,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(28,25,23,0.85)',
  },
  incomeChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  incomeChipText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
  },
  incomeChipTextSelected: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHT.bold,
  },

  // Boton
  continueButtonWrapper: {
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.xxl,
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
