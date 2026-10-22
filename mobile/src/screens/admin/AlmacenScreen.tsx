import React, { useState, useMemo, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../../constants';
import { SegmentedControl } from '../../components/SegmentedControl';
import { PurchasesListScreen } from '../purchases/PurchasesListScreen';
import { InventoryHubScreen } from '../inventory/InventoryHubScreen';

type TabId = 'Compras' | 'Inventario';

interface AlmacenScreenProps {
  route?: {
    params?: {
      initialTab?: TabId;
    };
  };
}

export const AlmacenScreen: React.FC<AlmacenScreenProps> = ({ route }) => {
  const initialTab = route?.params?.initialTab ?? 'Compras';
  const [selectedTab, setSelectedTab] = useState<TabId>(initialTab);

  // Actualizar selectedTab si initialTab cambia
  useEffect(() => {
    setSelectedTab(initialTab);
  }, [initialTab]);

  const segments = useMemo(
    () => [
      {
        id: 'Compras' as TabId,
        label: 'Compras',
        icon: 'bag-outline' as const,
      },
      {
        id: 'Inventario' as TabId,
        label: 'Inventario',
        icon: 'cube-outline' as const,
      },
    ],
    [],
  );

  return (
    <View style={styles.container}>
      <View style={styles.controlContainer}>
        <SegmentedControl
          segments={segments}
          selectedId={selectedTab}
          onChange={(id) => setSelectedTab(id as TabId)}
        />
      </View>
      <View style={styles.screenContainer}>
        {selectedTab === 'Compras' && <PurchasesListScreen />}
        {selectedTab === 'Inventario' && <InventoryHubScreen />}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
  },
  controlContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  screenContainer: {
    flex: 1,
  },
});
