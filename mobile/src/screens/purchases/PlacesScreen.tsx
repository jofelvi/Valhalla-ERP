import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
  SHADOWS,
} from '../../constants';
import { purchasesService, Supplier } from '../../services/purchasesService';
import { showAlert } from '../../utils/alert';
import { useBusqueda } from '../../hooks/useBusqueda';

export const PlacesScreen: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null,
  );
  const [renameText, setRenameText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      setIsLoading(true);
      const data = await purchasesService.getSuppliers();
      setSuppliers(data);
    } catch (error) {
      console.error('[PlacesScreen] Error loading suppliers:', error);
      showAlert('Error', 'No se pudieron cargar los lugares');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSuppliers = useBusqueda(suppliers, searchText, ['name']);

  const handleCreateSupplier = async () => {
    if (!newSupplierName.trim()) {
      showAlert('Validación', 'Ingresa el nombre del lugar');
      return;
    }

    try {
      setIsSubmitting(true);
      const newSupplier = await purchasesService.createSupplier(
        newSupplierName.trim(),
      );
      setSuppliers([...suppliers, newSupplier]);
      setNewSupplierName('');
      setShowNewModal(false);
      showAlert('Éxito', 'Lugar creado correctamente');
    } catch (error) {
      console.error('[PlacesScreen] Error creating supplier:', error);
      showAlert('Error', 'No se pudo crear el lugar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRenameSupplier = async () => {
    if (!selectedSupplier || !renameText.trim()) {
      showAlert('Validación', 'Ingresa el nuevo nombre');
      return;
    }

    try {
      setIsSubmitting(true);
      const updated = await purchasesService.updateSupplier(
        selectedSupplier.id,
        renameText.trim(),
      );
      const newSuppliers = suppliers.map((s) =>
        s.id === updated.id ? updated : s,
      );
      setSuppliers(newSuppliers);
      setShowRenameModal(false);
      setSelectedSupplier(null);
      setRenameText('');
      showAlert('Éxito', 'Lugar renombrado correctamente');
    } catch (error) {
      console.error('[PlacesScreen] Error renaming supplier:', error);
      showAlert('Error', 'No se pudo renombrar el lugar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditPress = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setRenameText(supplier.name);
    setShowRenameModal(true);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando lugares...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Barra de búsqueda y botón agregar */}
      <View style={styles.headerContainer}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar lugar..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText !== '' && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Ionicons
                name="close-circle"
                size={20}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setNewSupplierName('');
            setShowNewModal(true);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={24} color={COLORS.background} />
        </TouchableOpacity>
      </View>

      {/* Lista de lugares */}
      {filteredSuppliers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="storefront-outline"
            size={48}
            color={COLORS.textSecondary}
          />
          <Text style={styles.emptyText}>
            {searchText
              ? 'No se encontraron lugares'
              : 'Sin lugares registrados'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredSuppliers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.supplierCard}
              onPress={() => handleEditPress(item)}
              activeOpacity={0.7}
            >
              <View style={styles.supplierInfo}>
                <Text style={styles.supplierName}>{item.name}</Text>
                {item.phone && (
                  <Text style={styles.supplierPhone}>{item.phone}</Text>
                )}
                {item.address && (
                  <Text style={styles.supplierAddress}>{item.address}</Text>
                )}
              </View>
              <Ionicons
                name="chevron-forward"
                size={24}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
          )}
        />
      )}

      {/* Modal crear lugar */}
      <Modal
        visible={showNewModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNewModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuevo Lugar</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nombre del lugar"
              placeholderTextColor={COLORS.textSecondary}
              value={newSupplierName}
              onChangeText={setNewSupplierName}
              editable={!isSubmitting}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowNewModal(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleCreateSupplier}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={COLORS.background} />
                ) : (
                  <Text style={styles.confirmButtonText}>Crear</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal renombrar lugar */}
      <Modal
        visible={showRenameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRenameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Renombrar Lugar</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nuevo nombre"
              placeholderTextColor={COLORS.textSecondary}
              value={renameText}
              onChangeText={setRenameText}
              editable={!isSubmitting}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowRenameModal(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleRenameSupplier}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={COLORS.background} />
                ) : (
                  <Text style={styles.confirmButtonText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.small,
  },
  listContent: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  supplierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  supplierInfo: {
    flex: 1,
  },
  supplierName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  supplierPhone: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  supplierAddress: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 350,
    ...SHADOWS.medium,
  },
  modalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
  },
  confirmButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.background,
  },
});
