import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuthStore } from '../../store';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
} from '../../constants';
import type { RootStackParamList } from '../../navigation/types';
import { showAlert } from '../../utils/alert';
import { Button } from '../../components/ui';

type Nav = NativeStackNavigationProp<RootStackParamList, 'VerifyEmail'>;

/**
 * Pantalla para confirmar la cuenta con el codigo de 6 digitos que llega por
 * correo. No bloquea el uso de la app; es un paso recomendado tras registrarse.
 */
export const VerifyEmailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const verifyEmail = useAuthStore((s) => s.verifyEmail);
  const resendVerification = useAuthStore((s) => s.resendVerification);

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const onVerify = useCallback(async () => {
    if (code.trim().length !== 6 || verifying) return;
    setVerifying(true);
    try {
      await verifyEmail(code);
      showAlert('Cuenta verificada', 'Tu correo quedo confirmado.', [
        { text: 'Listo', onPress: () => navigation.goBack() },
      ]);
    } catch {
      showAlert('Codigo invalido', 'Revisa el codigo o pide uno nuevo.');
    } finally {
      setVerifying(false);
    }
  }, [code, verifying, verifyEmail, navigation]);

  const onResend = useCallback(async () => {
    if (resending) return;
    setResending(true);
    try {
      const res = await resendVerification();
      showAlert(
        res.alreadyVerified ? 'Ya estas verificado' : 'Codigo enviado',
        res.alreadyVerified
          ? 'Tu correo ya estaba confirmado.'
          : 'Te enviamos un nuevo codigo por correo.',
      );
    } catch {
      showAlert('Ups', 'No se pudo reenviar el codigo.');
    } finally {
      setResending(false);
    }
  }, [resending, resendVerification]);

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="mail-open-outline" size={40} color={COLORS.primary} />
      </View>
      <Text style={styles.title}>Verifica tu correo</Text>
      <Text style={styles.subtitle}>
        Escribe el codigo de 6 digitos que enviamos a{'\n'}
        <Text style={styles.email}>{user?.email ?? 'tu correo'}</Text>
      </Text>

      <TouchableOpacity
        activeOpacity={1}
        style={styles.codeBox}
        onPress={() => inputRef.current?.focus()}
      >
        <Text style={styles.codeText}>{code.padEnd(6, '•')}</Text>
      </TouchableOpacity>
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
      />

      <Button
        label={verifying ? 'Verificando...' : 'Verificar'}
        variant="primary"
        onPress={onVerify}
        disabled={code.trim().length !== 6 || verifying}
        loading={verifying}
        style={{ width: '100%' }}
      />

      <Button
        label={resending ? 'Reenviando...' : 'Reenviar codigo'}
        variant="ghost"
        onPress={onResend}
        disabled={resending}
        loading={resending}
      />

      <Button
        label="Mas tarde"
        variant="ghost"
        onPress={() => navigation.goBack()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    padding: SPACING.xl,
    paddingTop: SPACING.xxxl,
    gap: SPACING.md,
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: `${COLORS.primary}1A`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: COLORS.text,
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  email: { color: COLORS.text, fontWeight: FONT_WEIGHT.semibold },
  codeBox: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  codeText: {
    color: COLORS.text,
    fontSize: 34,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 12,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
});
