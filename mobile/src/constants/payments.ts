/**
 * Constantes compartidas de pagos: bancos, métodos de pago y configuraciones.
 * Extrae la duplicación hardcodeada en WaiterPaymentScreen, CashierPaymentScreen, etc.
 */

import { PaymentMethodEnum } from '../types';

/**
 * Lista de bancos con código y nombre para Pago Móvil.
 */
export const BANCOS = [
  { code: '0102', name: 'Banco de Venezuela (BDV)' },
  { code: '0134', name: 'Banesco' },
  { code: '0105', name: 'Mercantil' },
  { code: '0108', name: 'Provincial / BBVA' },
  { code: '0191', name: 'BNC Nacional de Crédito' },
  { code: '0175', name: 'Bicentenario del Pueblo' },
  { code: '0115', name: 'Exterior' },
  { code: '0114', name: 'Bancaribe' },
  { code: '0172', name: 'Bancamiga' },
  { code: '0174', name: 'Banplus' },
  { code: '0171', name: 'Activo' },
  { code: '0163', name: 'Banco del Tesoro' },
  { code: '0177', name: 'Banfanb' },
  { code: '0104', name: 'Venezolano de Crédito' },
  { code: '0128', name: 'Banco Caroní' },
  { code: '0137', name: 'Sofitasa' },
  { code: '0138', name: 'Banco Plaza' },
  { code: '0146', name: 'Bangente' },
  { code: '0151', name: 'BFC Fondo Común' },
  { code: '0156', name: '100% Banco' },
  { code: '0157', name: 'DelSur Banco Universal' },
  { code: '0166', name: 'Agrícola de Venezuela' },
  { code: '0168', name: 'Bancrecer' },
  { code: '0169', name: 'Mi Banco' },
] as const;

/**
 * Configuración de cada método de pago.
 */
export interface MethodConfig {
  method: PaymentMethodEnum;
  label: string;
  icon: string;
  needsReference: boolean;
  amountCurrency: 'USD' | 'BS';
}

export const METHOD_CONFIGS: MethodConfig[] = [
  {
    method: PaymentMethodEnum.CASH_USD,
    label: 'Efectivo USD',
    icon: 'cash-outline',
    needsReference: false,
    amountCurrency: 'USD',
  },
  {
    method: PaymentMethodEnum.CASH_BS,
    label: 'Efectivo Bs',
    icon: 'cash-outline',
    needsReference: false,
    amountCurrency: 'BS',
  },
  {
    method: PaymentMethodEnum.PAGO_MOVIL,
    label: 'Pago Móvil',
    icon: 'phone-portrait-outline',
    needsReference: true,
    amountCurrency: 'BS',
  },
  {
    method: PaymentMethodEnum.TRANSFER,
    label: 'Transferencia',
    icon: 'swap-horizontal-outline',
    needsReference: true,
    amountCurrency: 'USD',
  },
  {
    method: PaymentMethodEnum.CARD,
    label: 'Punto de Venta',
    icon: 'card-outline',
    needsReference: true,
    amountCurrency: 'BS',
  },
];

/**
 * Obtiene la configuración de un método de pago específico.
 */
export const getMethodConfig = (method: PaymentMethodEnum): MethodConfig => {
  const config = METHOD_CONFIGS.find((c) => c.method === method);
  return config ?? METHOD_CONFIGS[0];
};

/**
 * Obtiene un banco por código.
 */
export const getBancoByCodigo = (code: string) => {
  return BANCOS.find((b) => b.code === code);
};
