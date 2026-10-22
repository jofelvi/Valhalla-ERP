import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
} from '../../constants';
import { productService } from '../../services';
import { inventoryService } from '../../services/inventoryService';
import { useCategorias } from '../../queries/useCatalogo';
import { ProductWriteInput } from '../../services/productService';
import type { InsumoProduct } from '../../services/inventoryService';
import {
  productFormSchema,
  ProductFormValues,
} from '../../schemas/productSchemas';
import { BarcodeScannerModal } from '../../components';
import { Button, Input } from '../../components/ui';
import {
  Category,
  ProductStationEnum,
  CurrencyEnum,
  ProductTypeEnum,
  PRODUCT_TYPE_LABEL,
} from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { showAlert } from '../../utils/alert';
import {
  sonUnidadesCompatibles,
  mensajeUnidadIncompatible,
} from '../../utils/unidades';
import { filtrarLocal } from '../../utils/busquedaTexto';

import { useVocab } from '../../config/hooks';
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'ProductEdit'>;

type ScannerTarget = 'primary' | 'additional';

export const ProductEditScreen: React.FC = () => {
  const vocab = useVocab();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const productId = route.params?.productId;
  const isEdit = !!productId;

  // ── Receta ────────────────────────────────────────────────────────────────
  // Un producto sin receta NO descuenta inventario: cada plato sin ingredientes
  // se convierte en un faltante falso que le cae al personal. Por eso se puede
  // cargar desde aquí, y si el producto es BASE se convierte a MIXED al guardar
  // (lo hace el propio endpoint de receta).
  const [receta, setReceta] = useState<
    Array<{
      productId: string;
      nombre: string;
      quantity: number;
      unit: string;
      presentation?: string | null;
    }>
  >([]);
  const [tipoProducto, setTipoProducto] = useState<string>('BASE');
  const [insumos, setInsumos] = useState<InsumoProduct[]>([]);
  const [showInsumoPicker, setShowInsumoPicker] = useState(false);
  const [buscarInsumo, setBuscarInsumo] = useState('');
  const [insumoElegido, setInsumoElegido] = useState<InsumoProduct | null>(
    null,
  );
  const [cantidadIng, setCantidadIng] = useState('');
  const [unidadIng, setUnidadIng] = useState('gr');
  const [guardandoReceta, setGuardandoReceta] = useState(false);
  // Tiempo de preparacion y quien lo prepara: con eso el servidor le pone
  // precio al minuto (sueldo de esa persona) y el plato deja de costar solo
  // lo que pesa. El sueldo NUNCA viaja al telefono.
  const [minutosPrep, setMinutosPrep] = useState('');
  const [preparadorId, setPreparadorId] = useState('');
  const [preparadores, setPreparadores] = useState<
    Array<{ id: string; name: string; position: string }>
  >([]);
  const [showPreparadorPicker, setShowPreparadorPicker] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [extraBarcodes, setExtraBarcodes] = useState<string[]>([]);
  const [scannerTarget, setScannerTarget] = useState<ScannerTarget | null>(
    null,
  );

  const [subcategoryId, setSubcategoryId] = useState('');

  const { data: categories = [], isLoading } = useCategorias();

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: yupResolver(productFormSchema),
    defaultValues: {
      name: '',
      description: '',
      categoryId: '',
      price: '',
      cost: '',
      station: 'NONE',
      isActive: true,
      isForSale: true,
      barcode: '',
    },
  });

  useEffect(() => {
    const load = async () => {
      try {
        if (productId) {
          const p = await productService.getById(productId);
          if (p) {
            setTipoProducto(String(p.type ?? 'BASE'));
            if (p.prepTimeMinutes) setMinutosPrep(String(p.prepTimeMinutes));
            if (p.preparedByEmployeeId) {
              setPreparadorId(String(p.preparedByEmployeeId));
            }
            productService
              .listPreparers()
              .then(setPreparadores)
              .catch(() => setPreparadores([]));
            const ings = (p.ingredients ?? []) as Array<{
              productId: string;
              quantity: number;
              unit: string;
            }>;
            if (ings.length) {
              const todos = await inventoryService.getInsumos().catch(() => []);
              setInsumos(todos);
              setReceta(
                ings.map((i) => {
                  const foundInsumo = todos.find(
                    (x: InsumoProduct) => x.id === String(i.productId),
                  );
                  return {
                    productId: String(i.productId),
                    nombre: foundInsumo?.name ?? 'Insumo',
                    quantity: Number(i.quantity ?? 0),
                    unit: String(i.unit ?? 'gr'),
                    presentation: foundInsumo?.presentation,
                  };
                }),
              );
            }
            reset({
              name: p.name,
              description: p.description ?? '',
              categoryId: p.categoryId,
              price: String(p.price ?? ''),
              cost: p.cost != null ? String(p.cost) : '',
              station:
                p.station === ProductStationEnum.KITCHEN
                  ? 'KITCHEN'
                  : p.station === ProductStationEnum.BAR
                    ? 'BAR'
                    : p.station === ProductStationEnum.PIZZA
                      ? 'PIZZA'
                      : 'NONE',
              isActive: p.isActive,
              isForSale: p.isForSale,
              barcode: p.barcode ?? '',
            });
            setSubcategoryId(p.subcategoryId ?? '');
            setExtraBarcodes(p.barcodes ?? []);
          }
        }
      } catch {
        showAlert('Error', 'No se pudieron cargar los datos');
      }
    };
    load();
  }, [productId, reset]);

  const onScanned = (code: string) => {
    const clean = code.trim();
    setScannerTarget(null);
    if (!clean) return;
    if (scannerTarget === 'primary') {
      setValue('barcode', clean);
    } else if (scannerTarget === 'additional') {
      setExtraBarcodes((prev) =>
        prev.includes(clean) ? prev : [...prev, clean],
      );
    }
  };

  const removeExtra = (code: string) => {
    setExtraBarcodes((prev) => prev.filter((c) => c !== code));
  };

  const onSubmit = async (values: ProductFormValues) => {
    if (isSaving) return;

    // Códigos a validar: el principal + los adicionales, sin vacíos.
    const primary = values.barcode.trim();
    const allCodes = [primary, ...extraBarcodes].filter((c) => c.length > 0);

    // Duplicados dentro del mismo formulario
    const seen = new Set<string>();
    for (const c of allCodes) {
      if (seen.has(c)) {
        showAlert(
          'Código repetido',
          `El código "${c}" está dos veces en este producto`,
        );
        return;
      }
      seen.add(c);
    }

    setIsSaving(true);
    try {
      // Unicidad contra el catálogo (excluye el propio producto)
      if (allCodes.length > 0) {
        const all = await productService.getAllForAdmin();
        for (const other of all) {
          if (other.id === productId) continue;
          const otherCodes = [other.barcode, ...(other.barcodes ?? [])].filter(
            (c): c is string => !!c,
          );
          const clash = allCodes.find((c) => otherCodes.includes(c));
          if (clash) {
            setIsSaving(false);
            showAlert(
              'Código en uso',
              `El código "${clash}" ya está asignado a "${other.name}"`,
            );
            return;
          }
        }
      }

      const station: ProductStationEnum | null =
        values.station === 'KITCHEN'
          ? ProductStationEnum.KITCHEN
          : values.station === 'BAR'
            ? ProductStationEnum.BAR
            : values.station === 'PIZZA'
              ? ProductStationEnum.PIZZA
              : null;

      const dto: ProductWriteInput = {
        name: values.name.trim(),
        description: values.description.trim() || null,
        categoryId: values.categoryId,
        subcategoryId: subcategoryId || null,
        price: Number(values.price),
        cost: values.cost.trim() ? Number(values.cost) : undefined,
        station,
        isActive: values.isActive,
        isForSale: values.isForSale,
        barcode: primary || null,
        barcodes: extraBarcodes,
        type: tipoProducto as ProductTypeEnum,
      };

      if (isEdit && productId) {
        await productService.updateProduct(productId, dto);
      } else {
        await productService.createProduct({
          ...dto,
          currency: CurrencyEnum.USD,
        });
      }
      navigation.goBack();
    } catch (e) {
      showAlert(
        'Error al guardar',
        e instanceof Error ? e.message : 'No se pudo guardar. Reintenta.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const stationValue = watch('station');
  const categoryValue = watch('categoryId');

  const abrirSelectorInsumos = async () => {
    if (!insumos.length) {
      const todos = await inventoryService.getInsumos().catch(() => []);
      setInsumos(todos);
    }
    setShowInsumoPicker(true);
  };
  const agregarIngrediente = () => {
    const cant = parseFloat(cantidadIng.replace(',', '.'));
    if (!insumoElegido || !Number.isFinite(cant) || cant <= 0) {
      showAlert(
        'Falta algo',
        'Elige el insumo y escribe una cantidad mayor que cero',
      );
      return;
    }
    if (receta.some((r) => r.productId === insumoElegido.id)) {
      showAlert('Repetido', `${insumoElegido.name} ya está en la receta`);
      return;
    }
    setReceta((prev) => [
      ...prev,
      {
        productId: insumoElegido.id,
        nombre: insumoElegido.name,
        quantity: cant,
        unit: unidadIng,
        presentation: insumoElegido.presentation,
      },
    ]);
    setInsumoElegido(null);
    setCantidadIng('');
  };
  const guardarReceta = async () => {
    if (!productId) return;

    // Validar compatibilidad de unidades
    const incompatibles = receta.filter(
      (r) => !sonUnidadesCompatibles(r.unit, r.presentation),
    );
    if (incompatibles.length > 0) {
      const msgs = incompatibles
        .map((r) => mensajeUnidadIncompatible(r.nombre, r.presentation))
        .join('\n\n');
      showAlert('Unidades incompatibles', msgs);
      return;
    }

    setGuardandoReceta(true);
    try {
      const minutos = parseInt(minutosPrep.replace(/[^0-9]/g, ''), 10);
      const actualizado = await productService.updateRecipe(
        productId,
        receta.map((r) => ({
          productId: r.productId,
          quantity: r.quantity,
          unit: r.unit,
          wastePercentage: 0,
        })),
        {
          ...(Number.isFinite(minutos) ? { prepTimeMinutes: minutos } : {}),
          ...(preparadorId ? { preparedByEmployeeId: preparadorId } : {}),
        },
      );
      setTipoProducto(String(actualizado.type ?? 'MIXED'));
      // Los avisos vienen del servidor (p. ej. un ingrediente que es a su vez
      // un producto compuesto): se muestran tal cual para que quien carga la
      // receta sepa que ese insumo hay que producirlo.
      const avisos =
        (actualizado as unknown as { avisos?: string[] }).avisos ?? [];
      showAlert(
        'Receta guardada',
        `${receta.length} ingrediente(s). El producto quedo como ${actualizado.type} y ahora descuenta del inventario al venderse.` +
          (avisos.length ? '\n\n⚠ ' + avisos.join('\n\n') : ''),
      );
    } catch (e) {
      // El mensaje del backend explica el motivo real (p. ej. producto de otra
      // estación): mostrarlo tal cual evita el clásico "no se pudo guardar".
      showAlert(
        'No se guardó la receta',
        e instanceof Error ? e.message : 'Error desconocido',
      );
    } finally {
      setGuardandoReceta(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>
        {isEdit ? 'Editar producto' : 'Nuevo producto'}
      </Text>

      {/* Nombre */}
      <Controller
        control={control}
        name="name"
        render={({ field: { value, onChange } }) => (
          <Input
            label="Nombre"
            value={value}
            onChangeText={onChange}
            placeholder="Nombre del producto"
            error={errors.name?.message}
          />
        )}
      />

      {/* Descripción */}
      <Controller
        control={control}
        name="description"
        render={({ field: { value, onChange } }) => (
          <Input
            label="Descripción"
            value={value}
            onChangeText={onChange}
            placeholder="Opcional"
            multiline
            numberOfLines={3}
            error={errors.description?.message}
          />
        )}
      />

      {/* Categoría */}
      <Text style={styles.label}>Categoría</Text>
      <View style={styles.chipsWrap}>
        {categories
          .filter((c) => !c.parentId)
          .map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.chip, categoryValue === c.id && styles.chipActive]}
              onPress={() => {
                setValue('categoryId', c.id);
                setSubcategoryId('');
              }}
            >
              <Text
                style={[
                  styles.chipText,
                  categoryValue === c.id && styles.chipTextActive,
                ]}
              >
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
      </View>
      {errors.categoryId && (
        <Text style={styles.error}>{errors.categoryId.message}</Text>
      )}

      {/* Subcategoría — solo si la categoría tiene subcategorías */}
      {categoryValue &&
        (() => {
          const subcats = categories.filter(
            (c) => c.parentId === categoryValue,
          );
          return subcats.length > 0 ? (
            <>
              <Text style={styles.label}>Subcategoría (opcional)</Text>
              <View style={styles.chipsWrap}>
                <TouchableOpacity
                  style={[styles.chip, !subcategoryId && styles.chipActive]}
                  onPress={() => setSubcategoryId('')}
                >
                  <Text
                    style={[
                      styles.chipText,
                      !subcategoryId && styles.chipTextActive,
                    ]}
                  >
                    Ninguna
                  </Text>
                </TouchableOpacity>
                {subcats.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.chip,
                      subcategoryId === c.id && styles.chipActive,
                    ]}
                    onPress={() => setSubcategoryId(c.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        subcategoryId === c.id && styles.chipTextActive,
                      ]}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null;
        })()}

      {/* Precio y costo */}
      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Precio (USD)</Text>
          <Controller
            control={control}
            name="price"
            render={({ field: { value, onChange } }) => (
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={onChange}
                placeholder="0.00"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="decimal-pad"
              />
            )}
          />
          {errors.price && (
            <Text style={styles.error}>{errors.price.message}</Text>
          )}
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Costo (USD)</Text>
          <Controller
            control={control}
            name="cost"
            render={({ field: { value, onChange } }) => (
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={onChange}
                placeholder="0.00"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="decimal-pad"
              />
            )}
          />
          {errors.cost && (
            <Text style={styles.error}>{errors.cost.message}</Text>
          )}
        </View>
      </View>

      {/* Estación */}
      <Text style={styles.label}>Estación</Text>
      <View style={styles.segment}>
        {(['KITCHEN', 'BAR', 'PIZZA', 'NONE'] as const).map((s) => (
          <TouchableOpacity
            key={s}
            style={[
              styles.segmentItem,
              stationValue === s && styles.segmentItemActive,
            ]}
            onPress={() => setValue('station', s)}
          >
            <Text
              style={[
                styles.segmentText,
                stationValue === s && styles.segmentTextActive,
              ]}
            >
              {s === 'KITCHEN'
                ? vocab.kitchen
                : s === 'BAR'
                  ? vocab.bar
                  : s === 'PIZZA'
                    ? 'Pizza'
                    : 'Ninguna'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Naturaleza del producto */}
      <Text style={styles.label}>Naturaleza</Text>
      <View style={styles.segment}>
        {(Object.values(ProductTypeEnum) as ProductTypeEnum[]).map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.segmentItem,
              tipoProducto === type && styles.segmentItemActive,
            ]}
            onPress={() => setTipoProducto(type)}
          >
            <Text
              style={[
                styles.segmentText,
                tipoProducto === type && styles.segmentTextActive,
              ]}
            >
              {PRODUCT_TYPE_LABEL[type]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Switches */}
      <Controller
        control={control}
        name="isActive"
        render={({ field: { value, onChange } }) => (
          <View style={styles.switchRow}>
            <Text style={styles.label}>Activo</Text>
            <Switch value={value} onValueChange={onChange} />
          </View>
        )}
      />
      <Controller
        control={control}
        name="isForSale"
        render={({ field: { value, onChange } }) => (
          <View style={styles.switchRow}>
            <Text style={styles.label}>A la venta</Text>
            <Switch value={value} onValueChange={onChange} />
          </View>
        )}
      />

      {/* Código de barras principal */}
      <Text style={styles.label}>Código de barras</Text>
      <View style={styles.barcodeRow}>
        <Controller
          control={control}
          name="barcode"
          render={({ field: { value, onChange } }) => (
            <TextInput
              style={[styles.input, styles.barcodeInput]}
              value={value}
              onChangeText={onChange}
              placeholder="Escanea o escribe"
              placeholderTextColor={COLORS.textSecondary}
            />
          )}
        />
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={() => setScannerTarget('primary')}
        >
          <Ionicons name="barcode-outline" size={22} color={COLORS.textWhite} />
        </TouchableOpacity>
      </View>

      {/* Códigos adicionales */}
      <Text style={styles.label}>Códigos adicionales</Text>
      {extraBarcodes.map((c) => (
        <View key={c} style={styles.extraRow}>
          <Text style={styles.extraCode}>{c}</Text>
          <TouchableOpacity onPress={() => removeExtra(c)}>
            <Ionicons name="trash-outline" size={20} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      ))}
      <Button
        variant="ghost"
        size="sm"
        label="Agregar código con cámara"
        icon={<Ionicons name="add" size={18} color={COLORS.primary} />}
        onPress={() => setScannerTarget('additional')}
      />

      {/* ── RECETA ─────────────────────────────────────────────────────────── */}
      {isEdit && (
        <View style={styles.recetaBox}>
          <Text style={styles.recetaTitulo}>
            Receta {tipoProducto === 'MIXED' ? '(producto mixto)' : ''}
          </Text>
          <Text style={styles.recetaAyuda}>
            {tipoProducto === 'MIXED'
              ? 'Lo que lleva este producto. Al venderse, cada ingrediente se descuenta del inventario.'
              : 'Este producto es BASE: al guardar la receta pasa a mixto y empieza a descontar inventario.'}
          </Text>

          {receta.map((r, i) => {
            const esIncompatible = !sonUnidadesCompatibles(
              r.unit,
              r.presentation,
            );
            return (
              <View
                key={r.productId}
                style={[
                  styles.recetaFila,
                  esIncompatible && styles.recetaFilaIncompatible,
                ]}
              >
                <View style={styles.recetaFilaLeft}>
                  <Text
                    style={[
                      styles.recetaNombre,
                      esIncompatible && styles.recetaNombreError,
                    ]}
                    numberOfLines={1}
                  >
                    {r.nombre}
                  </Text>
                  {esIncompatible && (
                    <Text style={styles.recetaErrorMsg}>
                      {mensajeUnidadIncompatible(r.nombre, r.presentation)}
                    </Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.recetaCantidad,
                    esIncompatible && styles.recetaCantidadError,
                  ]}
                >
                  {r.quantity} {r.unit}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    setReceta((prev) => prev.filter((_, j) => j !== i))
                  }
                >
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={esIncompatible ? COLORS.error : COLORS.error}
                  />
                </TouchableOpacity>
              </View>
            );
          })}

          {receta.length === 0 && (
            <Text style={styles.recetaVacia}>
              Sin ingredientes — este producto no descuenta nada al venderse.
            </Text>
          )}

          <Button
            variant="ghost"
            size="sm"
            label={insumoElegido ? insumoElegido.name : 'Elegir insumo...'}
            icon={<Ionicons name="add" size={18} color={COLORS.primary} />}
            onPress={abrirSelectorInsumos}
          />

          <View style={styles.recetaCantRow}>
            <TextInput
              style={styles.recetaCantInput}
              placeholder="Cantidad"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="decimal-pad"
              value={cantidadIng}
              onChangeText={setCantidadIng}
            />
            {['gr', 'ml', 'und'].map((u) => (
              <TouchableOpacity
                key={u}
                style={[
                  styles.recetaUnidad,
                  unidadIng === u && styles.recetaUnidadOn,
                ]}
                onPress={() => setUnidadIng(u)}
              >
                <Text
                  style={[
                    styles.recetaUnidadTexto,
                    unidadIng === u && styles.recetaUnidadTextoOn,
                  ]}
                >
                  {u}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.recetaOkBtn}
              onPress={agregarIngrediente}
            >
              <Ionicons name="checkmark" size={20} color={COLORS.textWhite} />
            </TouchableOpacity>
          </View>

          {/* Tiempo de preparacion: con esto el plato cuesta tambien el
              tiempo de quien lo hace, no solo lo que pesa. */}
          <Text style={styles.recetaSubtitulo}>Tiempo de preparación</Text>
          <View style={styles.recetaCantRow}>
            <TextInput
              style={styles.recetaCantInput}
              placeholder="Minutos"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="number-pad"
              value={minutosPrep}
              onChangeText={setMinutosPrep}
            />
            <TouchableOpacity
              style={styles.recetaPrepBtn}
              onPress={() => setShowPreparadorPicker(true)}
            >
              <Ionicons
                name="person-outline"
                size={16}
                color={COLORS.primary}
              />
              <Text style={styles.recetaAddText} numberOfLines={1}>
                {preparadores.find((e) => e.id === preparadorId)?.name ??
                  'Quién lo prepara'}
              </Text>
            </TouchableOpacity>
          </View>

          <Button
            variant="primary"
            size="md"
            label="Guardar receta"
            loading={guardandoReceta}
            disabled={guardandoReceta}
            onPress={guardarReceta}
          />
        </View>
      )}

      {/* Guardar */}
      <Button
        variant="primary"
        size="lg"
        label={isEdit ? 'Guardar cambios' : 'Crear producto'}
        loading={isSaving}
        disabled={isSaving}
        onPress={handleSubmit(onSubmit)}
      />

      {/* Selector de insumo */}
      <Modal
        visible={showInsumoPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowInsumoPicker(false)}
      >
        <View style={styles.modalFondo}>
          <View style={styles.modalCaja}>
            <Text style={styles.modalTitulo}>Elegir insumo</Text>
            <TextInput
              style={styles.recetaCantInput}
              placeholder="Buscar..."
              placeholderTextColor={COLORS.textSecondary}
              value={buscarInsumo}
              onChangeText={setBuscarInsumo}
              autoFocus
            />
            <FlatList
              data={filtrarLocal(insumos, buscarInsumo, ['name'])}
              keyExtractor={(i) => i.id}
              keyboardShouldPersistTaps="handled"
              style={styles.modalLista}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setInsumoElegido(item);
                    setShowInsumoPicker(false);
                    setBuscarInsumo('');
                  }}
                >
                  <Text style={styles.modalItemTexto}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.recetaVacia}>
                  Sin resultados. El ingrediente debe existir como producto de
                  inventario.
                </Text>
              }
            />
            <TouchableOpacity
              style={styles.modalCerrar}
              onPress={() => setShowInsumoPicker(false)}
            >
              <Text style={styles.recetaAddText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Quién lo prepara */}
      <Modal
        visible={showPreparadorPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPreparadorPicker(false)}
      >
        <View style={styles.modalFondo}>
          <View style={styles.modalCaja}>
            <Text style={styles.modalTitulo}>Quién lo prepara</Text>
            <FlatList
              data={preparadores}
              keyExtractor={(e) => e.id}
              style={styles.modalLista}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setPreparadorId(item.id);
                    setShowPreparadorPicker(false);
                  }}
                >
                  <Text style={styles.modalItemTexto}>{item.name}</Text>
                  <Text style={styles.recetaVacia}>{item.position}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.modalCerrar}
              onPress={() => {
                setPreparadorId('');
                setShowPreparadorPicker(false);
              }}
            >
              <Text style={styles.recetaAddText}>Quitar encargado</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <BarcodeScannerModal
        visible={scannerTarget !== null}
        onClose={() => setScannerTarget(null)}
        onScanned={onScanned}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxxl },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  heading: {
    color: COLORS.textWhite,
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    marginBottom: SPACING.lg,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.surface,
    color: COLORS.textWhite,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZE.md,
  },
  error: { color: COLORS.error, fontSize: FONT_SIZE.xs, marginTop: SPACING.xs },
  row: { flexDirection: 'row', gap: SPACING.md },
  half: { flex: 1 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
  },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  chipTextActive: { color: COLORS.textWhite, fontWeight: FONT_WEIGHT.semibold },
  segment: { flexDirection: 'row', gap: SPACING.sm },
  segmentItem: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  segmentItemActive: { backgroundColor: COLORS.primary },
  segmentText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  segmentTextActive: {
    color: COLORS.textWhite,
    fontWeight: FONT_WEIGHT.semibold,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  barcodeRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  barcodeInput: { flex: 1 },
  scanBtn: {
    backgroundColor: COLORS.primary,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    width: 46,
    height: 46,
  },
  extraRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.xs,
  },
  extraCode: { color: COLORS.textWhite, fontSize: FONT_SIZE.sm },
  addExtraText: { color: COLORS.primary, fontSize: FONT_SIZE.sm },
  recetaBox: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  recetaTitulo: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  recetaAyuda: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  recetaFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  recetaFilaIncompatible: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.error,
    paddingLeft: SPACING.sm,
  },
  recetaFilaLeft: {
    flex: 1,
  },
  recetaNombre: { color: COLORS.text, fontSize: FONT_SIZE.sm },
  recetaNombreError: { color: COLORS.error },
  recetaCantidad: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  recetaCantidadError: { color: COLORS.error },
  recetaErrorMsg: {
    color: COLORS.error,
    fontSize: FONT_SIZE.xs,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
  recetaVacia: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontStyle: 'italic',
  },
  recetaAddText: { color: COLORS.primary, fontSize: FONT_SIZE.sm },
  recetaCantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  recetaCantInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
  },
  recetaUnidad: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.background,
  },
  recetaUnidadOn: { backgroundColor: COLORS.primary },
  recetaUnidadTexto: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  recetaUnidadTextoOn: {
    color: COLORS.textWhite,
    fontWeight: FONT_WEIGHT.bold,
  },
  recetaOkBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
  },
  recetaSubtitulo: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    marginTop: SPACING.sm,
  },
  recetaPrepBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  modalFondo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCaja: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    maxHeight: '80%',
    gap: SPACING.sm,
  },
  modalTitulo: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  modalLista: { maxHeight: 320 },
  modalItem: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalItemTexto: { color: COLORS.text, fontSize: FONT_SIZE.sm },
  modalCerrar: { alignItems: 'center', paddingVertical: SPACING.sm },
});
