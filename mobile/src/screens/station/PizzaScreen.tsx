import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { PantallaDeEstacion } from './PantallaDeEstacion';

type PizzaScreenProps = NativeStackScreenProps<RootStackParamList, 'Pizza'>;

// El pizzero gana el boton de inventario que Cocina y Barra ya tenian: su
// stack registraba las pantallas y no habia por donde entrar (23/09/2026).
export const PizzaScreen: React.FC<PizzaScreenProps> = ({ navigation }) => (
  <PantallaDeEstacion
    station="PIZZA"
    onAbrirInventario={() => navigation.navigate('InventoryHub')}
  />
);
