import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  FONT_SIZE,
  FONT_WEIGHT,
} from '../../constants';
import { useAuthStore } from '../../store';
import { useBusqueda } from '../../hooks/useBusqueda';
import {
  inventoryService,
  type InsumoProduct,
  type ProductionPlan,
} from '../../services/inventoryService';
import type { RootStackParamList } from '../../navigation/types';
import { showAlert } from '../../utils/alert';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** El rol de la app → la estación que entiende el backend. */
const STATION_BY_ROLE: Record<string, string> = {
  kitchen: 'KITCHEN',
  bar: 'BAR',
  pizza: 'PIZZA',
};

/**
 * La estación declara lo que elaboró (masas, salsa, porciones de pollo).
 *
 * No escribe inventario: crea una solicitud que gerencia autoriza. Antes de
 * enviar muestra QUÉ CRUDO se va a descontar, para que quien elabora vea el
 * efecto y para que nadie declare a ciegas.
 */
export const StationProductionScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const role = useAuthStore((s) => s.user?.role);
  const station = STATION_BY_ROLE[String(role ?? '')] ?? 'KITCHEN';

  const [insumos, setInsumos] = useState<InsumoProduct[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<InsumoProduct | null>(null);
  const [qty, setQty] = useState('');
  const [plan, setPlan] = useState<ProductionPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    inventoryService
      .getInsumos()
      .then(setInsumos)
      .catch(() =>
        showAlert('Error', 'No se pudo cargar la lista de productos'),
      )
      .finally(() => setIsLoading(false));
  }, []);

  const searchResults = useBusqueda(insumos, search, ['name']);
  const filtered = searchResults.slice(0, 40);

  const cantidad = Number(qty.replace(',', '.'));

  /** Consulta al backend qué descontaría, sin registrar nada. */
  const checkPlan = useCallback(async () => {
    if (!selected || !Number.isFinite(cantidad) || cantidad <= 0) return;
    setIsChecking(true);
    try {
      const [result] = await inventoryService.previewProduction(station, [
        { productId: selected.id, qty: cantidad, unit: selected.baseUnit },
      ]);
      setPlan(result ?? null);
    } catch {
      showAlert('Error', 'No se pudo calcular qué descuenta esta producción');
    } finally {
      setIsChecking(false);
    }
  }, [selected, cantidad, station]);

  useEffect(() => {
    setPlan(null);
    if (!selected || !Number.isFinite(cantidad) || cantidad <= 0) return;
    const t = setTimeout(() => void checkPlan(), 500);
    return () => clearTimeout(t);
  }, [selected, cantidad, checkPlan]);

  const submit = async () => {
    if (!selected || !plan || isSending) return;
    if (plan.blockers.length) {
      showAlert('No se puede registrar', plan.blockers.join('\n\n'));
      return;
    }
    setIsSending(true);
    try {
      await inventoryService.requestProduction(station, [
        {
          productId: selected.id,
          productName: selected.name,
          qty: cantidad,
          unit: selected.baseUnit ?? 'UND',
        },
      ]);
      showAlert(
        'Enviado',
        'Gerencia debe autorizarlo para que entre al inventario.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      showAlert(
        'No se pudo enviar',
        e instanceof Error ? e.message : 'Intenta de nuevo',
      );
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!selected ? (
        <>
          <Text style={styles.hint}>¿Qué elaboraste?</Text>
          <TextInput
            style={styles.search}
            placeholder="Buscar (masa, salsa, porción...)"
            placeholderTextColor={COLORS.textSecondary}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
          <FlatList
            data={filtered}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                onPress={() => {
                  setSelected(item);
                  setSearch('');
                }}
              >
                <Text style={styles.rowText}>{item.name}</Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                  No aparece lo que buscas. Puedes pedir que lo creen.
                </Text>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => navigation.navigate('StationNewInsumo')}
                >
                  <Text style={styles.secondaryBtnText}>
                    Solicitar insumo nuevo
                  </Text>
                </TouchableOpacity>
              </View>
            }
          />
        </>
      ) : (
        <>
          <View style={styles.selectedBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedName}>{selected.name}</Text>
              <Text style={styles.selectedUnit}>
                se mide en {selected.baseUnit ?? 'UND'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setSelected(null);
                setQty('');
                setPlan(null);
              }}
            >
              <Ionicons name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>¿Cuánto elaboraste?</Text>
          <TextInput
            style={styles.qtyInput}
            placeholder="0"
            placeholderTextColor={COLORS.textSecondary}
            value={qty}
            onChangeText={setQty}
            keyboardType="numeric"
          />

          {isChecking && (
            <View style={styles.checking}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.checkingText}>Calculando qué descuenta…</Text>
            </View>
          )}

          {plan && plan.blockers.length > 0 && (
            <View style={styles.blockerBox}>
              <Ionicons name="alert-circle" size={20} color={COLORS.error} />
              <Text style={styles.blockerText}>{plan.blockers.join('\n')}</Text>
            </View>
          )}

          {plan && plan.blockers.length === 0 && (
            <View style={styles.planBox}>
              <Text style={styles.planTitle}>Se descontará</Text>
              {plan.consumptions.map((c) => (
                <View key={c.productId} style={styles.planRow}>
                  <Text style={styles.planName}>{c.productName}</Text>
                  <Text
                    style={[
                      styles.planQty,
                      (c.resultingStock ?? 0) < 0 && styles.planQtyNeg,
                    ]}
                  >
                    −{c.qtyBase.toFixed(0)} {c.baseUnit}
                  </Text>
                </View>
              ))}
              {plan.warnings.map((w, i) => (
                <Text key={i} style={styles.warnText}>
                  ⚠ {w}
                </Text>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (!plan || plan.blockers.length > 0 || isSending) &&
                styles.primaryBtnDisabled,
            ]}
            onPress={() => void submit()}
            disabled={!plan || plan.blockers.length > 0 || isSending}
          >
            <Text style={styles.primaryBtnText}>
              {isSending ? 'Enviando…' : 'Enviar para autorización'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.md,
  },
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    marginBottom: SPACING.xs,
  },
  search: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.xs,
  },
  rowText: { flex: 1, color: COLORS.text, fontSize: FONT_SIZE.md },
  emptyBox: { padding: SPACING.lg, alignItems: 'center' },
  emptyText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  selectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  selectedName: {
    color: COLORS.text,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
  },
  selectedUnit: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  qtyInput: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    color: COLORS.text,
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  checking: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  checkingText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  planBox: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  planTitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  planName: { color: COLORS.text, flex: 1 },
  planQty: { color: COLORS.primary, fontWeight: FONT_WEIGHT.semibold },
  planQtyNeg: { color: COLORS.error },
  warnText: {
    color: COLORS.warning,
    fontSize: FONT_SIZE.xs,
    marginTop: SPACING.xs,
  },
  blockerBox: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: `${COLORS.error}15`,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  blockerText: { flex: 1, color: COLORS.error, fontSize: FONT_SIZE.sm },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHT.bold,
    fontSize: FONT_SIZE.md,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  secondaryBtnText: { color: COLORS.primary, fontWeight: FONT_WEIGHT.semibold },
});
