import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { PantallaDeEstacion } from './PantallaDeEstacion';

type KitchenScreenProps = NativeStackScreenProps<RootStackParamList, 'Kitchen'>;

export const KitchenScreen: React.FC<KitchenScreenProps> = ({ navigation }) => (
  <PantallaDeEstacion
    station="KITCHEN"
    onAbrirInventario={() => navigation.navigate('InventoryHub')}
  />
);
