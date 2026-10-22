import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { PantallaDeEstacion } from './PantallaDeEstacion';

type BarScreenProps = NativeStackScreenProps<RootStackParamList, 'Bar'>;

export const BarScreen: React.FC<BarScreenProps> = ({ navigation }) => (
  <PantallaDeEstacion
    station="BAR"
    onAbrirInventario={() => navigation.navigate('InventoryHub')}
  />
);
