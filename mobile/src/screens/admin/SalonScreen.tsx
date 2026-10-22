import React, { useState, useMemo, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../../constants';
import { SegmentedControl } from '../../components/SegmentedControl';
import { TablesScreen } from '../waiter/TablesScreen';
import { ZonesScreen } from '../waiter/ZonesScreen';
import { WaiterOrdersScreen } from '../waiter/WaiterOrdersScreen';

type TabId = 'Mesas' | 'Zonas' | 'Pedidos';

interface SalonScreenProps {
  route?: {
    params?: {
      initialTab?: TabId;
    };
  };
}

export const SalonScreen: React.FC<SalonScreenProps> = ({ route }) => {
  const initialTab = route?.params?.initialTab ?? 'Mesas';
  const [selectedTab, setSelectedTab] = useState<TabId>(initialTab);

  // Actualizar selectedTab si initialTab cambia
  useEffect(() => {
    setSelectedTab(initialTab);
  }, [initialTab]);

  const segments = useMemo(
    () => [
      { id: 'Mesas' as TabId, label: 'Mesas', icon: 'grid-outline' as const },
      { id: 'Zonas' as TabId, label: 'Zonas', icon: 'map-outline' as const },
      {
        id: 'Pedidos' as TabId,
        label: 'Pedidos',
        icon: 'receipt-outline' as const,
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
        {selectedTab === 'Mesas' && <TablesScreen />}
        {selectedTab === 'Zonas' && <ZonesScreen />}
        {selectedTab === 'Pedidos' && <WaiterOrdersScreen />}
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
