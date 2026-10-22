import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  FONT_SIZE,
  FONT_WEIGHT,
} from '../../constants';
import { useAuthStore } from '../../store';
import { inventoryService } from '../../services/inventoryService';
import { showAlert } from '../../utils/alert';

const STATION_BY_ROLE: Record<string, string> = {
  kitchen: 'KITCHEN',
  bar: 'BAR',
  pizza: 'PIZZA',
};

const UNITS: Array<{ value: string; label: string }> = [
  { value: 'UND', label: 'Unidades' },
  { value: 'GR', label: 'Gramos' },
  { value: 'ML', label: 'Mililitros' },
];

/**
 * La estación PROPONE un insumo que no está en el catálogo.
 *
 * No lo crea: eso queda en manos de gerencia, que al aprobar le pone costo,
 * criticidad y receta. Aquí solo se recoge lo que el personal sí sabe — qué
 * es, en qué se mide y para qué lo usa.
 */
export const StationNewInsumoScreen: React.FC = () => {
  const navigation = useNavigation();
  const role = useAuthStore((s) => s.user?.role);
  const station = STATION_BY_ROLE[String(role ?? '')] ?? 'KITCHEN';

  const [name, setName] = useState('');
  const [unit, setUnit] = useState('UND');
  const [purpose, setPurpose] = useState('');
  const [isSending, setIsSending] = useState(false);

  const submit = async () => {
    const clean = name.trim();
    if (!clean) {
      showAlert('Falta el nombre', '¿Cómo se llama lo que hace falta?');
      return;
    }
    setIsSending(true);
    try {
      await inventoryService.requestNewInsumo(station, {
        name: clean,
        unit,
        purpose: purpose.trim() || undefined,
      });
      showAlert('Enviado', 'Gerencia lo revisará y lo agregará al catálogo.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      showAlert(
        'No se pudo enviar',
        e instanceof Error ? e.message : 'Intenta de nuevo',
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>¿Qué hace falta?</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: Queso pecorino"
        placeholderTextColor={COLORS.textSecondary}
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>¿Cómo se mide?</Text>
      <View style={styles.unitRow}>
        {UNITS.map((u) => (
          <TouchableOpacity
            key={u.value}
            style={[styles.unitChip, unit === u.value && styles.unitChipActive]}
            onPress={() => setUnit(u.value)}
          >
            <Text
              style={[
                styles.unitText,
                unit === u.value && styles.unitTextActive,
              ]}
            >
              {u.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>¿Para qué lo usas? (opcional)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Ej: para la pizza de cuatro quesos"
        placeholderTextColor={COLORS.textSecondary}
        value={purpose}
        onChangeText={setPurpose}
        multiline
      />

      <Text style={styles.note}>
        Gerencia decide el costo y si lleva receta. Mientras tanto no aparecerá
        en tu inventario.
      </Text>

      <TouchableOpacity
        style={[styles.primaryBtn, isSending && styles.primaryBtnDisabled]}
        onPress={() => void submit()}
        disabled={isSending}
      >
        <Text style={styles.primaryBtnText}>
          {isSending ? 'Enviando…' : 'Enviar solicitud'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md },
  label: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  unitRow: { flexDirection: 'row', gap: SPACING.sm },
  unitChip: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border ?? COLORS.surface,
    alignItems: 'center',
  },
  unitChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  unitText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  unitTextActive: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHT.semibold,
  },
  note: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHT.bold,
    fontSize: FONT_SIZE.md,
  },
});
