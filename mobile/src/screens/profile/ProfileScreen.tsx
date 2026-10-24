import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { showAlert } from '../../utils/alert';
import { api } from '../../services/api/apiClient';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
  SHADOWS,
} from '../../constants';
import { APP_VERSION } from '../../config/appVersion';
import { useModulo, useNombreApp } from '../../config/hooks';
import { UserRoleEnum } from '../../types';
import { RootStackParamList } from '../../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  color?: string;
  showChevron?: boolean;
}

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const nombre = useNombreApp();
  const socios = useModulo('partners');
  const { customer, user, role, signOut, updateProfile } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(customer?.name ?? '');
  const [editPhone, setEditPhone] = useState(customer?.phone ?? '');
  const [editAddress, setEditAddress] = useState(customer?.address ?? '');
  const [editMemberNumber, setEditMemberNumber] = useState(
    customer?.memberNumber ?? '',
  );
  const [isSaving, setIsSaving] = useState(false);

  const avatarInitial = customer?.name?.charAt(0).toUpperCase() ?? 'U';

  // Mostrar botón "Fichar" para cocina, barra y pizza. El mesonero no lo ve aquí: ya ficha desde
  // su pestaña "Fichar" (WaiterTabs), y esta pila no tiene la pantalla de asistencia de ellos.
  const showAttendanceButton =
    role === UserRoleEnum.KITCHEN ||
    role === UserRoleEnum.BAR ||
    role === UserRoleEnum.PIZZA;

  const handleCheckIn = () => {
    navigation.navigate('StationAttendance');
  };

  const handleSignOut = () => {
    showAlert('Cerrar sesión', '¿Estás seguro de que deseas cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: signOut },
    ]);
  };

  // Apple (5.1.1 v) exige poder iniciar el borrado de la cuenta desde la app.
  // La solicitud queda registrada en la API y el equipo la procesa: si hay
  // saldo pendiente se elimina solo el acceso y se conservan los datos del
  // cobro. Nada se borra desde aquí.
  const enviandoBaja = useRef(false);

  const enviarSolicitudDeBaja = async () => {
    if (enviandoBaja.current) return;
    enviandoBaja.current = true;
    try {
      const r = await api.post<{ mensaje: string }>(
        '/api/account-deletion-requests',
        {},
      );
      showAlert('Solicitud recibida', r.mensaje);
      await signOut();
    } catch {
      showAlert('No se pudo enviar', 'Revisá tu conexión e intentá de nuevo.');
    } finally {
      enviandoBaja.current = false;
    }
  };

  const handleDeleteAccount = () => {
    showAlert(
      'Eliminar mi cuenta',
      'Vamos a registrar la solicitud para eliminar tu cuenta. Si tienes un saldo pendiente con el restaurante, solo se elimina tu acceso y se conservan los datos del cobro. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Solicitar',
          style: 'destructive',
          onPress: () => {
            void enviarSolicitudDeBaja();
          },
        },
      ],
    );
  };

  const handleStartEdit = () => {
    setEditName(customer?.name ?? '');
    setEditPhone(customer?.phone ?? '');
    setEditAddress(customer?.address ?? '');
    setEditMemberNumber(customer?.memberNumber ?? '');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      showAlert('Error', 'El nombre es requerido');
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({
        name: editName.trim(),
        phone: editPhone.trim() || null,
        address: editAddress.trim() || null,
        memberNumber: editMemberNumber.trim() || null,
      });
      setIsEditing(false);
      showAlert(
        '¡Perfil actualizado!',
        'Tu información ha sido guardada correctamente',
      );
    } catch {
      showAlert('Error', 'No se pudo actualizar el perfil');
    } finally {
      setIsSaving(false);
    }
  };

  const personalInfo: MenuItem[] = [
    {
      icon: 'person-outline',
      label: 'Nombre',
      value: customer?.name ?? '-',
    },
    {
      icon: 'mail-outline',
      label: 'Email',
      value: customer?.email ?? user?.email ?? '-',
    },
    {
      icon: 'call-outline',
      label: 'Teléfono',
      value: customer?.phone ?? '-',
    },
    {
      icon: 'location-outline',
      label: 'Dirección',
      value: customer?.address ?? '-',
    },
    {
      icon: 'card-outline',
      label: 'Número de socio',
      value: customer?.memberNumber ?? '-',
    },
  ];

  const appInfo: MenuItem[] = [
    {
      icon: 'help-circle-outline',
      label: 'Centro de ayuda',
      showChevron: true,
    },
    {
      icon: 'document-text-outline',
      label: 'Términos y condiciones',
      showChevron: true,
    },
    {
      icon: 'shield-checkmark-outline',
      label: 'Política de privacidad',
      showChevron: true,
    },
    {
      icon: 'information-circle-outline',
      label: 'Versión',
      value: APP_VERSION,
    },
  ];

  const renderMenuItem = (item: MenuItem, index: number, isLast: boolean) => (
    <TouchableOpacity
      key={index}
      style={[styles.menuItem, !isLast && styles.menuItemBorder]}
      onPress={item.onPress}
      disabled={!item.onPress && !item.showChevron}
      activeOpacity={item.onPress || item.showChevron ? 0.7 : 1}
    >
      <View
        style={[
          styles.menuIconContainer,
          { backgroundColor: `${item.color ?? COLORS.primary}15` },
        ]}
      >
        <Ionicons
          name={item.icon}
          size={18}
          color={item.color ?? COLORS.primary}
        />
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuLabel}>{item.label}</Text>
        {item.value && (
          <Text style={styles.menuValue} numberOfLines={1}>
            {item.value}
          </Text>
        )}
      </View>
      {item.showChevron && (
        <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            {/* Glow detrás del avatar */}
            <View style={styles.avatarGlow} />
            <LinearGradient
              colors={[COLORS.gradientStart, COLORS.gradientEnd]}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>{avatarInitial}</Text>
            </LinearGradient>
          </View>
          <Text style={styles.name}>{customer?.name ?? 'Usuario'}</Text>
          <Text style={styles.email}>{user?.email ?? ''}</Text>
          {customer?.memberNumber && (
            <View style={styles.memberBadge}>
              <Ionicons name="card-outline" size={13} color={COLORS.primary} />
              <Text style={styles.memberText}>
                Socio #{customer.memberNumber}
              </Text>
            </View>
          )}
        </View>

        {/* Info Personal */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Ionicons
                name="person-circle-outline"
                size={20}
                color={COLORS.primary}
              />
              <Text style={styles.sectionTitle}>Información Personal</Text>
            </View>
            {!isEditing && (
              <TouchableOpacity
                onPress={handleStartEdit}
                style={styles.editButton}
              >
                <Ionicons
                  name="create-outline"
                  size={16}
                  color={COLORS.primary}
                />
                <Text style={styles.editButtonText}>Editar</Text>
              </TouchableOpacity>
            )}
          </View>

          {isEditing ? (
            <View style={styles.sectionCard}>
              <Input
                label="Nombre"
                value={editName}
                onChangeText={setEditName}
                placeholder="Tu nombre completo"
              />
              <View style={styles.editFieldDivider} />
              <View style={styles.editField}>
                <Text style={styles.editLabel}>Email</Text>
                <Text style={styles.editReadonly}>
                  {customer?.email ?? user?.email ?? '-'}
                </Text>
              </View>
              <View style={styles.editFieldDivider} />
              <Input
                label="Teléfono"
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="Tu número de teléfono"
                keyboardType="phone-pad"
              />
              <View style={styles.editFieldDivider} />
              <Input
                label="Dirección"
                value={editAddress}
                onChangeText={setEditAddress}
                placeholder="Tu dirección"
              />
              {socios ? (
                <>
                  <View style={styles.editFieldDivider} />
                  <Input
                    label="Número de socio"
                    value={editMemberNumber}
                    onChangeText={setEditMemberNumber}
                    placeholder="Tu número de socio"
                  />
                </>
              ) : null}
              <View style={styles.editActions}>
                <Button
                  label="Cancelar"
                  variant="ghost"
                  size="md"
                  onPress={handleCancelEdit}
                  disabled={isSaving}
                />
                <Button
                  label="Guardar"
                  variant="primary"
                  size="md"
                  onPress={handleSaveProfile}
                  loading={isSaving}
                  disabled={isSaving}
                />
              </View>
            </View>
          ) : (
            <View style={styles.sectionCard}>
              {personalInfo.map((item, index) =>
                renderMenuItem(item, index, index === personalInfo.length - 1),
              )}
            </View>
          )}
        </View>

        {/* Info de la App */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Ionicons name="apps-outline" size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Acerca de la App</Text>
            </View>
          </View>
          <View style={styles.sectionCard}>
            {appInfo.map((item, index) =>
              renderMenuItem(item, index, index === appInfo.length - 1),
            )}
          </View>
        </View>

        {/* Fichar (solo para roles con asistencia) */}
        {showAttendanceButton && (
          <TouchableOpacity
            style={styles.checkInButton}
            onPress={handleCheckIn}
            activeOpacity={0.7}
          >
            <Ionicons
              name="finger-print-outline"
              size={20}
              color={COLORS.primary}
            />
            <Text style={styles.checkInText}>Fichar Entrada/Salida</Text>
          </TouchableOpacity>
        )}

        {/* Cerrar sesión */}
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={styles.signOutText}>Cerrar Sesión</Text>
        </TouchableOpacity>

        {/* Eliminar cuenta */}
        <TouchableOpacity
          style={styles.deleteAccountButton}
          onPress={handleDeleteAccount}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Eliminar mi cuenta"
        >
          <Ionicons
            name="trash-outline"
            size={18}
            color={COLORS.textSecondary}
          />
          <Text style={styles.deleteAccountText}>Eliminar mi cuenta</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{nombre}</Text>
          <Text style={styles.footerSubtext}>Hecho con ❤ para ti</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  header: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: SPACING.lg,
  },
  avatarGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primary,
    opacity: 0.2,
    top: -10,
    left: -10,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.background,
  },
  name: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  email: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: `${COLORS.primary}15`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: `${COLORS.primary}25`,
  },
  memberText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.semibold,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: `${COLORS.primary}12`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  editButtonText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.medium,
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuIconContainer: {
    width: 38,
    height: 38,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  menuValue: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: FONT_WEIGHT.medium,
  },
  // Modo edición
  editField: {
    padding: SPACING.lg,
  },
  editFieldDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.lg,
  },
  editLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: FONT_WEIGHT.semibold,
  },
  editReadonly: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textLight,
    fontWeight: FONT_WEIGHT.medium,
    paddingVertical: SPACING.xs,
  },
  editActions: {
    flexDirection: 'row',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${COLORS.primary}12`,
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: `${COLORS.primary}20`,
  },
  checkInText: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${COLORS.error}12`,
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: `${COLORS.error}20`,
  },
  signOutText: {
    color: COLORS.error,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  deleteAccountText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
    textDecorationLine: 'underline',
  },
  footer: {
    alignItems: 'center',
    marginTop: SPACING.xxl,
    paddingTop: SPACING.lg,
  },
  footerText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
  },
  footerSubtext: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
  },
});
