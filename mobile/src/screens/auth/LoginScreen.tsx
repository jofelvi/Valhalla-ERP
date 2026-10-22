import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Modal,
  Keyboard,
  Animated,
  Easing,
  StyleSheet,
  type TextInput as TextInputType,
  TouchableOpacity,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store';
import { useModal } from '../../hooks/useModal';
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
  createLoginSchema,
  type LoginFormValues,
} from '../../schemas/authSchemas';
import { useNombreApp } from '../../config/hooks';
import BrandLogo from '../../components/BrandLogo';

const FIRST_VISIT_KEY = 'pos:primeraVisita';

interface LoginScreenProps {
  navigation: { navigate: (screen: string) => void };
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const { t } = useTranslation(['auth', 'shared']);
  const nombre = useNombreApp();
  const schema = useMemo(() => createLoginSchema(t), [t]);

  const [showPassword, setShowPassword] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const forgotModal = useModal('forgotPasswordModal');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const signIn = useAuthStore((state) => state.signIn);
  const forgotPasswordAction = useAuthStore((state) => state.forgotPassword);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: yupResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const passwordRef = useRef<TextInputType | null>(null);

  // ── Animaciones: refs ──
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoGlow = useRef(new Animated.Value(0.3)).current;
  const brandOpacity = useRef(new Animated.Value(0)).current;
  const formY = useRef(new Animated.Value(28)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  // Blobs flotantes
  const blobFloat1 = useRef(new Animated.Value(0)).current;
  const blobFloat2 = useRef(new Animated.Value(0)).current;
  const blobFloat3 = useRef(new Animated.Value(0)).current;

  // Stagger: email, password, forgot+button, register link
  const staggerOpacity = useRef(
    [...Array(4)].map(() => new Animated.Value(0)),
  ).current;
  const staggerY = useRef(
    [...Array(4)].map(() => new Animated.Value(18)),
  ).current;

  // ── Entry animation ──
  useEffect(() => {
    Animated.parallel([
      // Fade global
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      // Logo scale + spring
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 55,
        friction: 7,
        useNativeDriver: true,
      }),
      // Brand fade in con delay
      Animated.sequence([
        Animated.delay(200),
        Animated.timing(brandOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
      // Form card slide up
      Animated.sequence([
        Animated.delay(130),
        Animated.parallel([
          Animated.spring(formY, {
            toValue: 0,
            tension: 60,
            friction: 11,
            useNativeDriver: true,
          }),
          Animated.timing(formOpacity, {
            toValue: 1,
            duration: 400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ]),
      // Stagger de campos
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
  }, [
    fadeAnim,
    logoScale,
    brandOpacity,
    formY,
    formOpacity,
    staggerOpacity,
    staggerY,
  ]);

  // ── Logo glow pulse (loop) ──
  useEffect(() => {
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoGlow, {
          toValue: 0.7,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(logoGlow, {
          toValue: 0.3,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    glowLoop.start();
    return () => glowLoop.stop();
  }, [logoGlow]);

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

    const loop1 = createBlobLoop(blobFloat1, 4000);
    const loop2 = createBlobLoop(blobFloat2, 5000);
    const loop3 = createBlobLoop(blobFloat3, 4500);
    loop1.start();
    loop2.start();
    loop3.start();
    return () => {
      loop1.stop();
      loop2.stop();
      loop3.stop();
    };
  }, [blobFloat1, blobFloat2, blobFloat3]);

  useEffect(() => {
    AsyncStorage.getItem(FIRST_VISIT_KEY).then((value) => {
      if (!value) {
        setIsFirstVisit(true);
        AsyncStorage.setItem(FIRST_VISIT_KEY, 'true');
      }
    });
  }, []);

  // ── Shake animation ──
  const triggerShake = () => {
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

  // ── Button press ──
  const onButtonPressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.96,
      tension: 300,
      friction: 20,
      useNativeDriver: true,
    }).start();
  };

  const onButtonPressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      tension: 300,
      friction: 20,
      useNativeDriver: true,
    }).start();
  };

  const onSubmit = async (data: LoginFormValues) => {
    Keyboard.dismiss();
    try {
      await signIn(data.email.trim(), data.password);
    } catch {
      triggerShake();
      clearError();
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    try {
      await forgotPasswordAction(forgotEmail.trim());
      setForgotSuccess(true);
    } catch {
      setForgotSuccess(false);
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotModal = () => {
    forgotModal.close();
    setForgotEmail('');
    setForgotSuccess(false);
  };

  const getAuthError = (): string | null => {
    if (!error) return null;
    if (
      error.includes('user-not-found') ||
      error.includes('wrong-password') ||
      error.includes('invalid-credential')
    ) {
      return t('shared:errors.invalid_credentials');
    }
    return t('shared:errors.sign_in_failed');
  };

  const welcomeTitle = isFirstVisit
    ? t('auth:login.title_first')
    : t('auth:login.title_returning');
  const welcomeSubtitle = isFirstVisit
    ? t('auth:login.subtitle_first')
    : t('auth:login.subtitle_returning');

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Blobs flotantes ── */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Animated.View
          style={[
            styles.blobTopLeft,
            { transform: [{ translateY: blobFloat1 }] },
          ]}
        />
        <Animated.View
          style={[
            styles.blobBottomRight,
            { transform: [{ translateY: blobFloat2 }] },
          ]}
        />
        <Animated.View
          style={[
            styles.blobCenter,
            { transform: [{ translateY: blobFloat3 }] },
          ]}
        />
      </View>

      <Animated.View style={[styles.keyboardView, { opacity: fadeAnim }]}>
        <ScrollView
          style={styles.keyboardView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
        >
          {/* ── Logo con glow ── */}
          <Animated.View
            style={[
              styles.logoSection,
              { opacity: fadeAnim, transform: [{ scale: logoScale }] },
            ]}
          >
            <View style={styles.logoContainer}>
              <Animated.View
                style={[styles.logoGlowRing, { opacity: logoGlow }]}
              />
              <View style={styles.logoWrapper}>
                <BrandLogo size={110} />
              </View>
            </View>
            <Animated.Text
              style={[styles.brandName, { opacity: brandOpacity }]}
            >
              {t('auth:login.brand', { nombre })}
            </Animated.Text>
            <Animated.Text style={[styles.tagline, { opacity: brandOpacity }]}>
              {t('auth:login.tagline')}
            </Animated.Text>
          </Animated.View>

          {/* ── Form card con shake ── */}
          <Animated.View
            style={[
              styles.formCard,
              {
                opacity: formOpacity,
                transform: [{ translateY: formY }, { translateX: shakeAnim }],
              },
            ]}
          >
            <Text style={styles.welcomeTitle}>{welcomeTitle}</Text>
            <Text style={styles.welcomeSubtitle}>{welcomeSubtitle}</Text>

            {/* Email */}
            <Animated.View
              style={{
                opacity: staggerOpacity[0],
                transform: [{ translateY: staggerY[0] }],
              }}
            >
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
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
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                )}
              />
            </Animated.View>

            {/* Password */}
            <Animated.View
              style={{
                opacity: staggerOpacity[1],
                transform: [{ translateY: staggerY[1] }],
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
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit(onSubmit, triggerShake)}
                  />
                )}
              />
            </Animated.View>

            {/* Error de autenticacion */}
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

            {/* Forgot + Boton */}
            <Animated.View
              style={{
                opacity: staggerOpacity[2],
                transform: [{ translateY: staggerY[2] }],
              }}
            >
              <TouchableOpacity
                style={styles.forgotPassword}
                onPress={() => {
                  setForgotEmail(getValues('email'));
                  forgotModal.open();
                }}
              >
                <Text style={styles.forgotPasswordText}>
                  {t('auth:login.forgot_password')}
                </Text>
              </TouchableOpacity>

              <Animated.View
                style={[
                  styles.loginButtonWrapper,
                  { transform: [{ scale: buttonScale }] },
                ]}
              >
                <Button
                  label={t('shared:actions.login')}
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
            </Animated.View>

            <Animated.View
              style={[
                styles.registerContainer,
                {
                  opacity: staggerOpacity[3],
                  transform: [{ translateY: staggerY[3] }],
                },
              ]}
            >
              <Text style={styles.registerText}>
                {t('auth:login.no_account')}{' '}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.registerLink}>
                  {t('auth:login.register_link')}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </Animated.View>

      {/* ── Modal: olvide contrasena ── */}
      <Modal
        visible={forgotModal.isOpen}
        transparent
        animationType="fade"
        onRequestClose={closeForgotModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {forgotSuccess ? (
              <>
                <View style={styles.modalSuccessIcon}>
                  <Ionicons
                    name="checkmark-circle"
                    size={52}
                    color={COLORS.success}
                  />
                </View>
                <Text style={styles.modalTitle}>
                  {t('auth:login.forgot_modal.success_title')}
                </Text>
                <Text style={styles.modalDescription}>
                  {t('auth:login.forgot_modal.success_description')}
                </Text>
                <Button
                  label={t('shared:actions.understood')}
                  variant="primary"
                  size="md"
                  onPress={closeForgotModal}
                />
              </>
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {t('auth:login.forgot_modal.title')}
                  </Text>
                  <TouchableOpacity
                    onPress={closeForgotModal}
                    style={styles.modalCloseButton}
                  >
                    <Ionicons
                      name="close"
                      size={18}
                      color={COLORS.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalDescription}>
                  {t('auth:login.forgot_modal.description')}
                </Text>
                <Input
                  leftIcon="mail-outline"
                  placeholder={t('shared:fields.email')}
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="send"
                  onSubmitEditing={handleForgotPassword}
                  style={styles.modalInputSpacing}
                />
                <Button
                  label={t('shared:actions.send_link')}
                  variant="primary"
                  size="md"
                  onPress={handleForgotPassword}
                  loading={forgotLoading}
                  disabled={forgotLoading || !forgotEmail.trim()}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },

  blobTopLeft: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: COLORS.primary,
    opacity: 0.07,
  },
  blobBottomRight: {
    position: 'absolute',
    bottom: -80,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: COLORS.primary,
    opacity: 0.05,
  },
  blobCenter: {
    position: 'absolute',
    top: '42%',
    left: '25%',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: COLORS.primaryDark,
    opacity: 0.03,
  },

  logoSection: {
    alignItems: 'center',
    paddingTop: SPACING.xxxl,
    paddingBottom: SPACING.xxl,
  },
  logoContainer: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  logoGlowRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
  },
  logoWrapper: {
    width: 110,
    height: 110,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: `${COLORS.primary}55`,
    overflow: 'hidden',
  },
  brandName: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
    letterSpacing: 1.5,
    marginBottom: SPACING.xs,
  },
  tagline: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  formCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    borderColor: `${COLORS.primary}20`,
    padding: SPACING.xxl,
  },
  welcomeTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  welcomeSubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xxl,
    lineHeight: 20,
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

  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: SPACING.xl,
    paddingVertical: SPACING.xs,
  },
  forgotPasswordText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.medium,
  },

  loginButtonWrapper: { borderRadius: BORDER_RADIUS.lg },

  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.xl,
  },
  registerText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  registerLink: {
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.bold,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xxl,
    padding: SPACING.xxl,
    width: '100%',
    borderWidth: 1,
    borderColor: `${COLORS.primary}20`,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalSuccessIcon: { alignItems: 'center', marginBottom: SPACING.lg },
  modalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  modalDescription: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  modalInputSpacing: { marginBottom: SPACING.xl },
});
