import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
} from '../constants';
import { customerService } from '../services';
import { Customer } from '../types';
import { showAlert } from '../utils/alert';

type Tab = 'search' | 'register';
type View_ = 'list' | 'edit';

export interface SelectedCustomer {
  id: string;
  name: string;
  associateNumber?: string | null;
  phone?: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (customer: SelectedCustomer) => void;
}

/** Espera antes de disparar la búsqueda mientras se escribe. */
const DEBOUNCE_MS = 350;
const MIN_CHARS = 2;

export const CustomerSelectModal: React.FC<Props> = ({
  visible,
  onClose,
  onSelect,
}) => {
  const [tab, setTab] = useState<Tab>('search');
  const [view, setView] = useState<View_>('list');

  // Búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  // Descarta respuestas viejas que llegan tarde y pisarían a las nuevas
  const requestId = useRef(0);

  // Edición
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);

  // Alta
  const [regName, setRegName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regCedula, setRegCedula] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regIsMember, setRegIsMember] = useState(false);
  const [regAssociate, setRegAssociate] = useState('');
  const [registering, setRegistering] = useState(false);

  const reset = () => {
    setTab('search');
    setView('list');
    setSearchQuery('');
    setSearchResults([]);
    setSearched(false);
    setEditingCustomer(null);
    setEditName('');
    setEditPhone('');
    setRegName('');
    setRegLastName('');
    setRegCedula('');
    setRegPhone('');
    setRegIsMember(false);
    setRegAssociate('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const pickCustomer = (c: Customer) => {
    Keyboard.dismiss();
    reset();
    onSelect({
      id: c.id,
      name: c.name,
      associateNumber:
        c.associateNumber ?? c.memberNumber ?? c.memberAction ?? null,
      phone: c.phone,
    });
  };

  /**
   * Búsqueda en vivo. El backend ya resuelve nombre multi-palabra, cédula,
   * teléfono y nº de acción (con o sin ceros), así que aquí no hace falta
   * adivinar el tipo de dato: se manda tal cual lo tecleó el mesonero.
   */
  const runSearch = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (q.length < MIN_CHARS) {
      setSearchResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    const id = ++requestId.current;
    setSearching(true);
    try {
      const results = await customerService.search(q);
      if (id !== requestId.current) return; // llegó tarde
      setSearchResults(results);
      setSearched(true);
    } catch {
      if (id !== requestId.current) return;
      setSearchResults([]);
      setSearched(true);
    } finally {
      if (id === requestId.current) setSearching(false);
    }
  }, []);

  // Dispara la búsqueda sola al escribir (con debounce)
  useEffect(() => {
    if (!visible || tab !== 'search' || view !== 'list') return;
    const t = setTimeout(() => void runSearch(searchQuery), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchQuery, visible, tab, view, runSearch]);

  const startEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setEditName(customer.name);
    setEditPhone(customer.phone || '');
    setView('edit');
  };

  const cancelEdit = () => {
    setEditingCustomer(null);
    setEditName('');
    setEditPhone('');
    setView('list');
  };

  const doEditCustomer = async () => {
    const name = editName.trim();
    if (!name) {
      showAlert('Nombre requerido', 'El nombre es obligatorio');
      return;
    }
    if (!editingCustomer) return;

    setUpdateLoading(true);
    try {
      const updated = await customerService.updateCustomer(editingCustomer.id, {
        name,
        phone: editPhone.trim() || undefined,
      });
      showAlert('Listo', 'Cliente actualizado');
      setSearchResults((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      );
      cancelEdit();
    } catch {
      showAlert('Error', 'No se pudo actualizar el cliente');
    } finally {
      setUpdateLoading(false);
    }
  };

  const doRegister = async () => {
    const name = regName.trim();
    if (!name) {
      showAlert('Nombre requerido', 'El nombre es obligatorio');
      return;
    }

    let paddedAction: string | undefined;
    let unverified = false;

    if (regIsMember) {
      const raw = regAssociate.trim();
      if (!raw || !/^\d+$/.test(raw)) {
        showAlert(
          'Número inválido',
          'El número de acción debe tener solo dígitos',
        );
        return;
      }
      paddedAction = raw.padStart(5, '0');
      setRegistering(true);

      // ¿Ya existe un cliente con esa acción? Entonces no hay que crear otro.
      try {
        const existing = await customerService.findByMemberAction(paddedAction);
        if (existing.length > 0) {
          setRegistering(false);
          showAlert(
            'Ese socio ya está registrado',
            `La acción ${paddedAction} es de ${existing[0].name}. Buscalo en la pestaña "Buscar".`,
          );
          return;
        }
      } catch {
        setRegistering(false);
        showAlert('Error', 'No se pudo verificar el número de acción');
        return;
      }

      // El padrón del club ya está cargado completo. Si la acción no figura,
      // es un alta manual que hay que revisar y que NO lleva crédito.
      try {
        await customerService.lookupMember(paddedAction);
      } catch {
        unverified = true;
      }
    } else {
      setRegistering(true);
    }

    try {
      const fullName = regLastName.trim()
        ? `${name} ${regLastName.trim()}`
        : name;
      const created = await customerService.create({
        name: fullName,
        cedula: regCedula.trim() || undefined,
        phone: regPhone.trim() || undefined,
        memberAction: paddedAction,
        isUnverifiedMember: unverified || undefined,
      });
      if (unverified) {
        showAlert(
          'Socio nuevo — queda marcado',
          `La acción ${paddedAction} no figura en el padrón del club. El cliente se creó marcado para revisión y SIN crédito.`,
        );
      }
      pickCustomer(created);
    } catch {
      showAlert('Error', 'No se pudo registrar el cliente');
    } finally {
      setRegistering(false);
    }
  };

  const renderTab = (
    key: Tab,
    label: string,
    icon: keyof typeof Ionicons.glyphMap,
  ) => (
    <TouchableOpacity
      style={[styles.tab, tab === key && styles.tabActive]}
      onPress={() => setTab(key)}
      key={key}
    >
      <Ionicons
        name={icon}
        size={18}
        color={tab === key ? COLORS.primary : COLORS.textSecondary}
      />
      <Text style={[styles.tabLabel, tab === key && styles.tabLabelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const emptyLabel = (): string => {
    if (searching) return '';
    if (searchQuery.trim().length < MIN_CHARS) {
      return 'Escribí el nombre, la cédula, el teléfono o el número de acción.';
    }
    if (searched) return 'Sin resultados. Podés darlo de alta en "Nuevo".';
    return '';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.overlay}>
          <View style={styles.container}>
            {/* ── Encabezado fijo ── */}
            <View style={styles.header}>
              <Text style={styles.title}>Cliente del pedido</Text>
              <TouchableOpacity
                onPress={close}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={26} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {view === 'list' && (
              <View style={styles.tabs}>
                {renderTab('search', 'Buscar', 'search-outline')}
                {renderTab('register', 'Nuevo', 'person-add-outline')}
              </View>
            )}

            {/* ── Buscar: input fijo arriba, resultados scrollean debajo ── */}
            {view === 'list' && tab === 'search' && (
              <View style={styles.flex}>
                <View style={styles.inputRow}>
                  <Ionicons
                    name="search"
                    size={18}
                    color={COLORS.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Nombre, cédula, teléfono o acción"
                    placeholderTextColor={COLORS.textSecondary}
                    autoFocus
                    autoCorrect={false}
                    returnKeyType="search"
                    onSubmitEditing={() => void runSearch(searchQuery)}
                  />
                  {searching ? (
                    <ActivityIndicator
                      color={COLORS.primary}
                      style={styles.inputIcon}
                    />
                  ) : searchQuery.length > 0 ? (
                    <TouchableOpacity
                      onPress={() => setSearchQuery('')}
                      style={styles.inputIcon}
                    >
                      <Ionicons
                        name="close-circle"
                        size={18}
                        color={COLORS.textSecondary}
                      />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <FlatList
                  data={searchResults}
                  keyExtractor={(c) => c.id}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  style={styles.flex}
                  contentContainerStyle={styles.listContent}
                  ListEmptyComponent={
                    emptyLabel() ? (
                      <Text style={styles.empty}>{emptyLabel()}</Text>
                    ) : null
                  }
                  renderItem={({ item: c }) => (
                    <View style={styles.resultRow}>
                      <TouchableOpacity
                        style={styles.flex}
                        onPress={() => pickCustomer(c)}
                      >
                        <Text style={styles.resultName} numberOfLines={1}>
                          {c.name}
                        </Text>
                        <Text style={styles.resultMeta} numberOfLines={1}>
                          {[
                            c.memberAction ? `Socio #${c.memberAction}` : null,
                            c.cedula || null,
                            c.phone || null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'Sin datos de contacto'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => startEdit(c)}
                        style={styles.editBtn}
                      >
                        <Ionicons
                          name="pencil"
                          size={18}
                          color={COLORS.primary}
                        />
                      </TouchableOpacity>
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={COLORS.textSecondary}
                      />
                    </View>
                  )}
                />
              </View>
            )}

            {/* ── Alta ── */}
            {view === 'list' && tab === 'register' && (
              <ScrollView
                style={styles.flex}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.label}>Nombre *</Text>
                <TextInput
                  style={styles.inputFull}
                  value={regName}
                  onChangeText={setRegName}
                  placeholder="Juan"
                  placeholderTextColor={COLORS.textSecondary}
                />

                <Text style={styles.label}>Apellido</Text>
                <TextInput
                  style={styles.inputFull}
                  value={regLastName}
                  onChangeText={setRegLastName}
                  placeholder="Pérez"
                  placeholderTextColor={COLORS.textSecondary}
                />

                <Text style={styles.label}>Cédula</Text>
                <TextInput
                  style={styles.inputFull}
                  value={regCedula}
                  onChangeText={setRegCedula}
                  placeholder="V-12345678"
                  placeholderTextColor={COLORS.textSecondary}
                />

                <Text style={styles.label}>Teléfono</Text>
                <TextInput
                  style={styles.inputFull}
                  value={regPhone}
                  onChangeText={setRegPhone}
                  placeholder="04141234567"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="phone-pad"
                />

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>¿Es socio?</Text>
                  <Switch
                    value={regIsMember}
                    onValueChange={setRegIsMember}
                    trackColor={{ false: COLORS.surface, true: COLORS.primary }}
                    thumbColor="#fff"
                  />
                </View>

                {regIsMember && (
                  <>
                    <Text style={styles.label}>Número de acción *</Text>
                    <TextInput
                      style={styles.inputFull}
                      value={regAssociate}
                      onChangeText={setRegAssociate}
                      placeholder="Ej: 590"
                      placeholderTextColor={COLORS.textSecondary}
                      keyboardType="number-pad"
                    />
                    <Text style={styles.hint}>
                      Si la acción no figura en el padrón del club, el cliente
                      queda marcado para revisión y sin crédito.
                    </Text>
                  </>
                )}

                <TouchableOpacity
                  style={[styles.primaryBtn, registering && styles.btnDisabled]}
                  onPress={doRegister}
                  disabled={registering}
                >
                  {registering ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <>
                      <Ionicons name="person-add" size={18} color="#000" />
                      <Text style={styles.primaryBtnText}>
                        Registrar y continuar
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* ── Edición ── */}
            {view === 'edit' && editingCustomer && (
              <ScrollView
                style={styles.flex}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.editTitle}>Editar cliente</Text>

                <Text style={styles.label}>Nombre *</Text>
                <TextInput
                  style={styles.inputFull}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Nombre del cliente"
                  placeholderTextColor={COLORS.textSecondary}
                />

                <Text style={styles.label}>Teléfono</Text>
                <TextInput
                  style={styles.inputFull}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="04141234567"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="phone-pad"
                />

                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    updateLoading && styles.btnDisabled,
                  ]}
                  onPress={doEditCustomer}
                  disabled={updateLoading}
                >
                  {updateLoading ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#000" />
                      <Text style={styles.primaryBtnText}>Guardar</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={cancelEdit}
                  disabled={updateLoading}
                >
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    // Casi pantalla completa: con el teclado abierto en un telefono, el 85%
    // anterior dejaba la lista de resultados debajo del teclado.
    height: '92%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: 4,
    marginBottom: SPACING.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    gap: 6,
    borderRadius: BORDER_RADIUS.sm,
  },
  tabActive: { backgroundColor: COLORS.background },
  tabLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.bold,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  inputIcon: { paddingHorizontal: SPACING.xs },
  input: {
    flex: 1,
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.md,
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
  },
  inputFull: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    marginBottom: SPACING.xs,
  },
  listContent: { paddingBottom: SPACING.xl },
  empty: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  hint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  editBtn: { padding: SPACING.xs },
  resultName: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: FONT_WEIGHT.bold,
  },
  resultMeta: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  editTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  switchLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: FONT_WEIGHT.medium,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.lg,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: {
    color: '#000',
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  cancelBtn: {
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.textSecondary,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  cancelBtnText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
  },
});
