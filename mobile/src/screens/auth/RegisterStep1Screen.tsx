import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Animated,
  Easing,
  Keyboard,
  Switch,
  type TextInput as TextInputType,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store';
import { api } from '../../services/api/apiClient';
import {
  findMemberByAction,
  MemberData,
} from '../../services/memberValidationService';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
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

type IdentificationType = 'V' | 'E' | 'P';

interface FormState {
  isMember: boolean;
  associateNumber: string;
  name: string;
  identificationType: IdentificationType;
  identificationId: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  associateNumber?: string;
  name?: string;
  identificationId?: string;
  phone?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

type RegisterStep1NavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

interface RegisterStep1ScreenProps {
  navigation: RegisterStep1NavigationProp;
}

// ── Componente FieldError ──────────────────────────────────────────

const FieldError: React.FC<{ message?: string }> = ({ message }) => {
  if (!message) return null;
  return (
    <View style={fieldErrorStyles.container}>
      <Ionicons name="alert-circle-outline" size={13} color={COLORS.error} />
      <Text style={fieldErrorStyles.text}>{message}</Text>
    </View>
  );
};

const fieldErrorStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  text: { fontSize: FONT_SIZE.xs, color: COLORS.error },
});

// ── Pantalla Principal ─────────────────────────────────────────────

export const RegisterStep1Screen: React.FC<RegisterStep1ScreenProps> = ({
  navigation,
}) => {
  // ── State ──
  const nombre = useNombreApp();
  const socios = useModulo('partners');
  const [form, setForm] = useState<FormState>({
    isMember: false,
    associateNumber: '',
    name: '',
    identificationType: 'V',
    identificationId: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Member validation state ──
  const [memberSearching, setMemberSearching] = useState(false);
  const [memberFound, setMemberFound] = useState<MemberData | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);

  // ── Auth store ──
  const signUp = useAuthStore((state) => state.signUp);
  const authError = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  // ── Refs ──
  const nameRef = useRef<TextInputType | null>(null);
  const identificationIdRef = useRef<TextInputType | null>(null);
  const phoneRef = useRef<TextInputType | null>(null);
  const emailRef = useRef<TextInputType | null>(null);
  const passwordRef = useRef<TextInputType | null>(null);
  const confirmPasswordRef = useRef<TextInputType | null>(null);
  const associateNumberRef = useRef<TextInputType | null>(null);

  // ── Animaciones ──
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerY = useRef(new Animated.Value(-24)).current;
  const formY = useRef(new Animated.Value(28)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const blobFloat1 = useRef(new Animated.Value(0)).current;
  const blobFloat2 = useRef(new Animated.Value(0)).current;
  const backScale = useRef(new Animated.Value(1)).current;
  const memberFieldHeight = useRef(new Animated.Value(0)).current;
  const memberFieldOpacity = useRef(new Animated.Value(0)).current;

  // ── Blobs flotantes (loop) ──
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

  // ── Helpers ──
  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      // Limpiar error del campo al escribir
      if (key in errors) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[key as keyof FormErrors];
          return next;
        });
      }
    },
    [errors],
  );

  const handleToggleMember = useCallback(
    (value: boolean) => {
      updateField('isMember', value);
      if (!value) {
        updateField('associateNumber', '');
        setMemberFound(null);
        setMemberError(null);
      }
      Animated.parallel([
        Animated.timing(memberFieldHeight, {
          toValue: value ? 1 : 0,
          duration: value ? 280 : 220,
          easing: value ? Easing.out(Easing.ease) : Easing.in(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(memberFieldOpacity, {
          toValue: value ? 1 : 0,
          duration: value ? 260 : 180,
          easing: value ? Easing.out(Easing.ease) : Easing.in(Easing.ease),
          useNativeDriver: false,
        }),
      ]).start();
    },
    [updateField, memberFieldHeight, memberFieldOpacity],
  );

  // ── Buscar socio por numero de accion ──
  const handleMemberLookup = useCallback(async () => {
    const actionStr = form.associateNumber.trim();
    if (!actionStr) return;

    const actionNumber = parseInt(actionStr, 10);
    if (isNaN(actionNumber)) {
      setMemberError('Ingresa un numero valido');
      setMemberFound(null);
      return;
    }

    setMemberSearching(true);
    setMemberError(null);
    setMemberFound(null);

    const member = await findMemberByAction(actionNumber);

    if (member) {
      setMemberFound(member);
      setMemberError(null);
      // Auto-fill nombre y cedula
      updateField('name', member.nombre);
      // Parsear cedula: puede venir como "V-12345678" o "12345678"
      const cedulaStr = member.cedula ?? '';
      const cedulaMatch = cedulaStr.match(/^([VEP])-?(.+)$/i);
      if (cedulaMatch) {
        const tipo = cedulaMatch[1].toUpperCase() as IdentificationType;
        updateField('identificationType', tipo);
        updateField('identificationId', cedulaMatch[2]);
      } else {
        updateField('identificationId', cedulaStr);
      }
    } else {
      setMemberError('Numero de socio no encontrado');
      setMemberFound(null);
    }

    setMemberSearching(false);
  }, [form.associateNumber, updateField]);

  // ── Shake ──
  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 12,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -12,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 8,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -8,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 4,
        duration: 45,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 45,
        useNativeDriver: true,
      }),
    ]).start();
  }, [shakeAnim]);

  // ── Validacion ──
  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!form.name.trim()) {
      newErrors.name = 'El nombre es obligatorio';
    }
    if (!form.identificationId.trim()) {
      newErrors.identificationId = 'La cedula es obligatoria';
    }
    if (!form.phone.trim()) {
      newErrors.phone = 'El telefono es obligatorio';
    }
    if (!form.email.trim()) {
      newErrors.email = 'El email es obligatorio';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      newErrors.email = 'Email invalido';
    }
    if (!form.password) {
      newErrors.password = 'La contrasena es obligatoria';
    } else if (form.password.length < 6) {
      newErrors.password = 'Minimo 6 caracteres';
    }
    if (!form.confirmPassword) {
      newErrors.confirmPassword = 'Confirma tu contrasena';
    } else if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = 'Las contrasenas no coinciden';
    }
    if (form.isMember && !form.associateNumber.trim()) {
      newErrors.associateNumber = 'Ingresa tu numero de accion';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  // ── Password strength ──
  const getStrength = useCallback((): {
    level: number;
    label: string;
    color: string;
  } => {
    if (!form.password) return { level: 0, label: '', color: COLORS.border };
    if (form.password.length < 6)
      return { level: 1, label: 'Debil', color: COLORS.error };
    if (form.password.length < 9)
      return { level: 2, label: 'Regular', color: COLORS.warning };
    return { level: 3, label: 'Fuerte', color: COLORS.success };
  }, [form.password]);

  const strength = getStrength();

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    Keyboard.dismiss();
    if (!validate()) {
      triggerShake();
      return;
    }

    setIsSubmitting(true);
    clearError();

    try {
      // 1. Crear cuenta Firebase Auth + doc en customers
      await signUp(
        form.email.trim(),
        form.password,
        form.name.trim(),
        form.phone.trim() || undefined,
        form.isMember ? form.associateNumber.trim() : undefined,
      );

      // 2. Completar identificacion del customer (el doc en `customers` ya lo
      //    creo el register, con la membresia). Antes esto mandaba
      //    associateNumber/isMember con nombres que el DTO descartaba y, ademas,
      //    no existia el customer que actualizar: se perdia todo en silencio.
      const uid = useAuthStore.getState().user?.id;
      if (uid) {
        await api.patch(`/api/customers/${uid}`, {
          identificationId: form.identificationId.trim(),
          identificationType: form.identificationType,
        });
      }

      // 3. Navegar al paso 2
      navigation.navigate('RegisterStep2', {
        isMember: form.isMember,
        associateNumber: form.isMember
          ? form.associateNumber.trim()
          : undefined,
      });
    } catch (err) {
      triggerShake();
      const message =
        err instanceof Error ? err.message : 'Error al crear la cuenta';
      if (message.includes('email-already-in-use')) {
        showAlert('Error', 'Este email ya esta registrado');
      } else {
        showAlert('Error', message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [form, validate, triggerShake, signUp, clearError, navigation]);

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
          <Animated.View style={{ transform: [{ scale: backScale }] }}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              onPressIn={() =>
                Animated.spring(backScale, {
                  toValue: 0.9,
                  tension: 300,
                  friction: 15,
                  useNativeDriver: true,
                }).start()
              }
              onPressOut={() =>
                Animated.spring(backScale, {
                  toValue: 1,
                  tension: 300,
                  friction: 15,
                  useNativeDriver: true,
                }).start()
              }
              activeOpacity={1}
            >
              <Ionicons name="arrow-back" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </Animated.View>

          {/* Step indicator */}
          <View style={styles.stepIndicator}>
            <LinearGradient
              colors={[COLORS.gradientStart, COLORS.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.stepBadge}
            >
              <Text style={styles.stepBadgeText}>Paso 1 de 5</Text>
            </LinearGradient>
          </View>

          <Text style={styles.title}>Crear Cuenta</Text>
          <Text style={styles.subtitle}>
            Registrate para disfrutar de {nombre}
          </Text>
        </Animated.View>

        {/* ── Form card ── */}
        <Animated.View
          style={[
            styles.formCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: formY }, { translateX: shakeAnim }],
            },
          ]}
        >
          {/* Error global */}
          {authError && (
            <View style={styles.errorContainer}>
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color={COLORS.error}
              />
              <Text style={styles.errorText}>
                {authError.includes('email-already-in-use')
                  ? 'Este email ya esta registrado'
                  : 'Error al registrarse'}
              </Text>
            </View>
          )}

          {/* ── Toggle socio (solo con el módulo de socios encendido) ── */}
          {socios && (
            <View style={styles.memberToggleContainer}>
              <View style={styles.memberToggleRow}>
                <View style={styles.memberToggleLeft}>
                  <Ionicons
                    name="card-outline"
                    size={20}
                    color={COLORS.primary}
                  />
                  <Text style={styles.memberToggleLabel}>¿Eres socio?</Text>
                </View>
                <Switch
                  value={form.isMember}
                  onValueChange={handleToggleMember}
                  trackColor={{
                    false: COLORS.border,
                    true: `${COLORS.primary}80`,
                  }}
                  thumbColor={
                    form.isMember ? COLORS.primary : COLORS.textSecondary
                  }
                />
              </View>
            </View>
          )}

          {/* ── Campo numero de accion (animado) ── */}
          <Animated.View
            style={{
              opacity: memberFieldOpacity,
              maxHeight: memberFieldHeight.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 140],
              }),
              overflow: 'hidden',
            }}
          >
            <View
              style={[
                styles.inputContainer,
                focusedInput === 'associateNumber' && styles.inputFocused,
                errors.associateNumber && styles.inputError,
                {
                  borderColor: `${COLORS.primary}50`,
                  backgroundColor: `${COLORS.primary}08`,
                },
              ]}
            >
              <Ionicons
                name="star-outline"
                size={20}
                color={COLORS.primary}
                style={styles.inputIcon}
              />
              <TextInput
                ref={associateNumberRef}
                style={styles.input}
                placeholder="Numero de accion"
                placeholderTextColor={COLORS.textLight}
                value={form.associateNumber}
                onChangeText={(v) => {
                  updateField('associateNumber', v);
                  setMemberFound(null);
                  setMemberError(null);
                }}
                onBlur={handleMemberLookup}
                keyboardType="number-pad"
                returnKeyType="next"
                onSubmitEditing={() => nameRef.current?.focus()}
              />
              {memberSearching && (
                <ActivityIndicator size="small" color={COLORS.primary} />
              )}
            </View>
            {errors.associateNumber && (
              <FieldError message={errors.associateNumber} />
            )}

            {/* Resultado de busqueda de socio */}
            {memberFound && (
              <View style={styles.memberFoundContainer}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={COLORS.success}
                />
                <Text style={styles.memberFoundText}>
                  Socio verificado: {memberFound.nombre}
                </Text>
              </View>
            )}
            {memberError && (
              <View style={styles.memberErrorContainer}>
                <Ionicons name="close-circle" size={18} color={COLORS.error} />
                <Text style={styles.memberErrorText}>{memberError}</Text>
              </View>
            )}
          </Animated.View>

          {/* ── Nombre y Apellido ── */}
          <Input
            ref={nameRef}
            leftIcon="person-outline"
            placeholder="Nombre y Apellido"
            value={form.name}
            onChangeText={(v) => updateField('name', v)}
            error={errors.name}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => identificationIdRef.current?.focus()}
          />

          {/* ── Cedula con selector V/E/P ── */}
          <View style={styles.cedulaRow}>
            {/* Tipo selector */}
            <View style={styles.cedulaTypeContainer}>
              {(['V', 'E', 'P'] as IdentificationType[]).map((tipo) => (
                <TouchableOpacity
                  key={tipo}
                  style={[
                    styles.cedulaTypeButton,
                    form.identificationType === tipo &&
                      styles.cedulaTypeButtonSelected,
                  ]}
                  onPress={() => updateField('identificationType', tipo)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.cedulaTypeText,
                      form.identificationType === tipo &&
                        styles.cedulaTypeTextSelected,
                    ]}
                  >
                    {tipo}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Numero de cedula */}
            <View
              style={[
                styles.inputContainer,
                styles.cedulaInput,
                focusedInput === 'identificationId' && styles.inputFocused,
                errors.identificationId && styles.inputError,
              ]}
            >
              <TextInput
                ref={identificationIdRef}
                style={styles.input}
                placeholder="Cedula"
                placeholderTextColor={COLORS.textLight}
                value={form.identificationId}
                onChangeText={(v) => updateField('identificationId', v)}
                onFocus={() => setFocusedInput('identificationId')}
                onBlur={() => setFocusedInput(null)}
                keyboardType="number-pad"
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
              />
            </View>
          </View>
          <FieldError message={errors.identificationId} />

          {/* ── Telefono ── */}
          <Input
            ref={phoneRef}
            leftIcon="call-outline"
            placeholder="Telefono"
            value={form.phone}
            onChangeText={(v) => updateField('phone', v)}
            error={errors.phone}
            keyboardType="phone-pad"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
          />

          {/* ── Email ── */}
          <Input
            ref={emailRef}
            leftIcon="mail-outline"
            placeholder="Email"
            value={form.email}
            onChangeText={(v) => updateField('email', v)}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          {/* ── Contrasena ── */}
          <Input
            ref={passwordRef}
            leftIcon="lock-closed-outline"
            placeholder="Contrasena"
            value={form.password}
            onChangeText={(v) => updateField('password', v)}
            error={errors.password}
            secureTextEntry={!showPassword}
            rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowPassword(!showPassword)}
            returnKeyType="next"
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
          />
          {!errors.password && form.password.length > 0 && (
            <View style={styles.strengthContainer}>
              <View style={styles.strengthBars}>
                {[1, 2, 3].map((bar) => (
                  <View
                    key={bar}
                    style={[
                      styles.strengthBar,
                      {
                        backgroundColor:
                          bar <= strength.level
                            ? strength.color
                            : COLORS.border,
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.strengthLabel, { color: strength.color }]}>
                {strength.label}
              </Text>
            </View>
          )}

          {/* ── Confirmar contrasena ── */}
          <Input
            ref={confirmPasswordRef}
            leftIcon="shield-checkmark-outline"
            placeholder="Confirmar Contrasena"
            value={form.confirmPassword}
            onChangeText={(v) => updateField('confirmPassword', v)}
            error={errors.confirmPassword}
            secureTextEntry={!showPassword}
            rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowPassword(!showPassword)}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          {/* ── Boton Crear Cuenta ── */}
          <Animated.View
            style={[
              styles.registerButtonWrapper,
              { transform: [{ scale: buttonScale }] },
            ]}
          >
            <Button
              label="Crear Cuenta"
              variant="primary"
              size="lg"
              onPress={handleSubmit}
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

          {/* ── Ya tienes cuenta? ── */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Ya tienes cuenta? </Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.loginLink}>Iniciar sesion</Text>
            </TouchableOpacity>
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
  backButton: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
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
    fontSize: FONT_SIZE.title,
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

  formCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    borderColor: `${COLORS.primary}20`,
    padding: SPACING.xxl,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28,25,23,0.85)',
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 54,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}0D`,
  },
  inputError: {
    borderColor: COLORS.error,
    backgroundColor: `${COLORS.error}08`,
  },
  inputIcon: { marginRight: SPACING.md },
  input: {
    flex: 1,
    paddingVertical: SPACING.lg,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  eyeButton: { padding: SPACING.sm },

  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: `${COLORS.error}15`,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: `${COLORS.error}35`,
  },
  errorText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.error,
    lineHeight: 18,
  },

  // Toggle socio
  memberToggleContainer: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  memberToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  memberToggleLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
  },

  // Socio encontrado / no encontrado
  memberFoundContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: `${COLORS.success}15`,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: `${COLORS.success}35`,
  },
  memberFoundText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.success,
    fontWeight: FONT_WEIGHT.medium,
  },
  memberErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: `${COLORS.error}15`,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: `${COLORS.error}35`,
  },
  memberErrorText: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.error },

  // Cedula row
  cedulaRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  cedulaTypeContainer: { flexDirection: 'row', gap: 4 },
  cedulaTypeButton: {
    width: 42,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(28,25,23,0.85)',
  },
  cedulaTypeButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  cedulaTypeText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textSecondary,
  },
  cedulaTypeTextSelected: { color: COLORS.background },
  cedulaInput: { flex: 1, marginBottom: 0 },

  // Strength
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  strengthBars: { flex: 1, flexDirection: 'row', gap: SPACING.xs },
  strengthBar: { flex: 1, height: 3, borderRadius: BORDER_RADIUS.full },
  strengthLabel: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },

  // Button
  registerButtonWrapper: {
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.lg,
  },

  // Login link
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.xl,
  },
  loginText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  loginLink: {
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.bold,
  },
});
