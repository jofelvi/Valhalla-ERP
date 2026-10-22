import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Animated,
  Easing,
  Keyboard,
  StyleSheet,
  type TextInput as TextInputType,
  TouchableOpacity,
} from 'react-native';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import {
  createRegisterSchema,
  type RegisterFormValues,
} from '../../schemas/authSchemas';
import { useModulo, useNombreApp } from '../../config/hooks';

interface RegisterScreenProps {
  navigation: { goBack: () => void };
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({
  navigation,
}) => {
  const { t } = useTranslation(['auth', 'shared']);
  const nombre = useNombreApp();
  const socios = useModulo('partners');
  const schema = useMemo(() => createRegisterSchema(t), [t]);

  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const signUp = useAuthStore((state) => state.signUp);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: yupResolver(schema) as unknown as Resolver<RegisterFormValues>,
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      isMember: false,
      memberNumber: '',
      password: '',
      confirmPassword: '',
    },
  });

  const isMember = watch('isMember');
  const password = watch('password');

  const emailRef = useRef<TextInputType | null>(null);
  const phoneRef = useRef<TextInputType | null>(null);
  const memberNumberRef = useRef<TextInputType | null>(null);
  const passwordRef = useRef<TextInputType | null>(null);
  const confirmPasswordRef = useRef<TextInputType | null>(null);

  // ─── Animaciones ─────────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerY = useRef(new Animated.Value(-24)).current;
  const formY = useRef(new Animated.Value(28)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  const staggerOpacity = useRef(
    [0, 1, 2, 3, 4, 5].map(() => new Animated.Value(0)),
  ).current;
  const staggerY = useRef(
    [0, 1, 2, 3, 4, 5].map(() => new Animated.Value(14)),
  ).current;

  const memberFieldHeight = useRef(new Animated.Value(0)).current;
  const memberFieldOpacity = useRef(new Animated.Value(0)).current;

  // Blobs flotantes
  const blobFloat1 = useRef(new Animated.Value(0)).current;
  const blobFloat2 = useRef(new Animated.Value(0)).current;

  // Back button scale
  const backScale = useRef(new Animated.Value(1)).current;

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
      Animated.sequence([
        Animated.delay(340),
        Animated.stagger(
          70,
          staggerOpacity.map((anim, i) =>
            Animated.parallel([
              Animated.timing(anim, {
                toValue: 1,
                duration: 300,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.spring(staggerY[i], {
                toValue: 0,
                tension: 70,
                friction: 12,
                useNativeDriver: true,
              }),
            ]),
          ),
        ),
      ]),
    ]).start();
  }, []);

  const handleToggleMember = (value: boolean) => {
    setValue('isMember', value, { shouldValidate: true });
    if (!value) setValue('memberNumber', '');
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
  };

  const triggerShake = () => {
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
  };

  const onSubmit = async (data: RegisterFormValues) => {
    Keyboard.dismiss();
    try {
      await signUp(
        data.email.trim(),
        data.password,
        data.name.trim(),
        data.phone?.trim() || undefined,
        data.isMember ? (data.memberNumber?.trim() ?? null) : null,
      );
    } catch {
      triggerShake();
      clearError();
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

  const getStrength = (): { level: number; label: string; color: string } => {
    if (!password) return { level: 0, label: '', color: COLORS.border };
    if (password.length < 6)
      return {
        level: 1,
        label: t('auth:register.password_strength.weak'),
        color: COLORS.error,
      };
    if (password.length < 9)
      return {
        level: 2,
        label: t('auth:register.password_strength.fair'),
        color: COLORS.warning,
      };
    return {
      level: 3,
      label: t('auth:register.password_strength.strong'),
      color: COLORS.success,
    };
  };
  const strength = getStrength();

  const getAuthError = (): string | null => {
    if (!error) return null;
    if (error.includes('email-already-in-use'))
      return t('shared:errors.email_in_use');
    return t('shared:errors.sign_up_failed');
  };

  return (
    <SafeAreaView style={styles.container}>
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
          <Text style={styles.title}>{t('auth:register.title')}</Text>
          <Text style={styles.subtitle}>
            {t('auth:register.subtitle', { nombre })}
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
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color={COLORS.error}
              />
              <Text style={styles.errorText}>{getAuthError()}</Text>
            </View>
          )}

          {/* Nombre — stagger[0] */}
          <Animated.View
            style={{
              opacity: staggerOpacity[0],
              transform: [{ translateY: staggerY[0] }],
            }}
          >
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  leftIcon="person-outline"
                  placeholder={t('shared:fields.full_name')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.name?.message}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              )}
            />
          </Animated.View>

          {/* Email — stagger[1] */}
          <Animated.View
            style={{
              opacity: staggerOpacity[1],
              transform: [{ translateY: staggerY[1] }],
            }}
          >
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  ref={emailRef}
                  leftIcon="mail-outline"
                  placeholder={t('shared:fields.email')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email?.message}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => phoneRef.current?.focus()}
                />
              )}
            />
          </Animated.View>

          {/* Teléfono — stagger[2] */}
          <Animated.View
            style={{
              opacity: staggerOpacity[2],
              transform: [{ translateY: staggerY[2] }],
            }}
          >
            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  ref={phoneRef}
                  leftIcon="call-outline"
                  placeholder={t('shared:fields.phone')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="phone-pad"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              )}
            />
          </Animated.View>

          {/* Toggle ¿Eres socio? — stagger[3]. Solo si el módulo de socios está encendido. */}
          {socios && (
            <Animated.View
              style={{
                opacity: staggerOpacity[3],
                transform: [{ translateY: staggerY[3] }],
              }}
            >
              <View style={styles.memberToggleContainer}>
                <View style={styles.memberToggleHeader}>
                  <Ionicons
                    name="card-outline"
                    size={18}
                    color={COLORS.primary}
                  />
                  <Text style={styles.memberToggleLabel}>
                    {t('auth:register.member.question')}
                  </Text>
                </View>
                <View style={styles.memberTogglePills}>
                  <TouchableOpacity
                    style={[
                      styles.memberPill,
                      !isMember && styles.memberPillSelected,
                    ]}
                    onPress={() => handleToggleMember(false)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="person-outline"
                      size={14}
                      color={
                        !isMember ? COLORS.background : COLORS.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.memberPillText,
                        !isMember && styles.memberPillTextSelected,
                      ]}
                    >
                      {t('auth:register.member.not_member')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.memberPill,
                      isMember && styles.memberPillSelectedGold,
                    ]}
                    onPress={() => handleToggleMember(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="star"
                      size={14}
                      color={
                        isMember ? COLORS.background : COLORS.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.memberPillText,
                        isMember && styles.memberPillTextSelected,
                      ]}
                    >
                      {t('auth:register.member.is_member')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Campo número de socio — animado */}
              <Animated.View
                style={{
                  opacity: memberFieldOpacity,
                  maxHeight: memberFieldHeight.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 80],
                  }),
                  overflow: 'hidden',
                }}
              >
                <Controller
                  control={control}
                  name="memberNumber"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      ref={memberNumberRef}
                      leftIcon="star-outline"
                      placeholder={t('shared:fields.member_number')}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={errors.memberNumber?.message}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      returnKeyType="next"
                      onSubmitEditing={() => passwordRef.current?.focus()}
                    />
                  )}
                />
              </Animated.View>
            </Animated.View>
          )}

          {/* Contraseña — stagger[4] */}
          <Animated.View
            style={{
              opacity: staggerOpacity[4],
              transform: [{ translateY: staggerY[4] }],
            }}
          >
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  ref={passwordRef}
                  leftIcon="lock-closed-outline"
                  placeholder={t('shared:fields.password')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                  secureTextEntry={!showPassword}
                  rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  onRightIconPress={() => setShowPassword(!showPassword)}
                  returnKeyType="next"
                  onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                />
              )}
            />
            {!errors.password && password.length > 0 && (
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
          </Animated.View>

          {/* Confirmar contraseña + botón — stagger[5] */}
          <Animated.View
            style={{
              opacity: staggerOpacity[5],
              transform: [{ translateY: staggerY[5] }],
            }}
          >
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  ref={confirmPasswordRef}
                  leftIcon="shield-checkmark-outline"
                  placeholder={t('shared:fields.confirm_password')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.confirmPassword?.message}
                  secureTextEntry={!showPassword}
                  rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  onRightIconPress={() => setShowPassword(!showPassword)}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit(onSubmit, triggerShake)}
                />
              )}
            />

            <View style={styles.termsContainer}>
              <Text style={styles.termsText}>
                {t('auth:register.terms.prefix')}{' '}
                <Text style={styles.termsLink}>
                  {t('auth:register.terms.terms_link')}
                </Text>{' '}
                {t('auth:register.terms.conjunction')}{' '}
                <Text style={styles.termsLink}>
                  {t('auth:register.terms.privacy_link')}
                </Text>
              </Text>
            </View>

            <Animated.View
              style={[
                styles.registerButtonWrapper,
                { transform: [{ scale: buttonScale }] },
              ]}
            >
              <Button
                label={t('shared:actions.register')}
                variant="primary"
                size="lg"
                onPress={handleSubmit(onSubmit, triggerShake)}
                onPressIn={onButtonPressIn}
                onPressOut={onButtonPressOut}
                loading={isLoading}
                disabled={isLoading}
                icon={
                  !isLoading ? (
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

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>
                {t('auth:register.already_have_account')}{' '}
              </Text>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.loginLink}>
                  {t('auth:register.login_link')}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Helper component ─────────────────────────────────────────────
const FieldError: React.FC<{ message?: string }> = ({ message }) => (
  <View style={fieldErrorStyles.container}>
    <Ionicons name="alert-circle-outline" size={13} color={COLORS.error} />
    <Text style={fieldErrorStyles.text}>{message}</Text>
  </View>
);

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
    marginBottom: SPACING.xl,
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

  memberToggleContainer: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  memberToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  memberToggleLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
  },
  memberTogglePills: { flexDirection: 'row', gap: SPACING.sm },
  memberPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  memberPillSelected: {
    backgroundColor: COLORS.textSecondary,
    borderColor: COLORS.textSecondary,
  },
  memberPillSelectedGold: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  memberPillText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textSecondary,
  },
  memberPillTextSelected: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHT.bold,
  },

  termsContainer: { marginVertical: SPACING.lg },
  termsText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
  termsLink: { color: COLORS.primary, fontWeight: FONT_WEIGHT.medium },

  registerButtonWrapper: { borderRadius: BORDER_RADIUS.lg },

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
