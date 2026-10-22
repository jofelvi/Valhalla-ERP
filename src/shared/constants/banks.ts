/**
 * Lista oficial de bancos de Venezuela.
 * Codigos asignados por SUDEBAN, usados en pago movil y transferencias.
 */
export interface VenezuelanBank {
  code: string;
  name: string;
}

export const VENEZUELAN_BANKS: ReadonlyArray<VenezuelanBank> = [
  { code: '0102', name: 'Banco de Venezuela (BDV)' },
  { code: '0104', name: 'Venezolano de Crédito' },
  { code: '0105', name: 'Mercantil' },
  { code: '0108', name: 'Provincial / BBVA' },
  { code: '0114', name: 'Bancaribe' },
  { code: '0115', name: 'Exterior' },
  { code: '0128', name: 'Banco Caroní' },
  { code: '0134', name: 'Banesco' },
  { code: '0137', name: 'Sofitasa' },
  { code: '0138', name: 'Banco Plaza' },
  { code: '0146', name: 'Bangente' },
  { code: '0151', name: 'BFC Fondo Común' },
  { code: '0156', name: '100% Banco' },
  { code: '0157', name: 'DelSur Banco Universal' },
  { code: '0163', name: 'Banco del Tesoro' },
  { code: '0166', name: 'Agrícola de Venezuela' },
  { code: '0168', name: 'Bancrecer' },
  { code: '0169', name: 'Mi Banco' },
  { code: '0171', name: 'Activo' },
  { code: '0172', name: 'Bancamiga' },
  { code: '0173', name: 'Banco Internacional de Desarrollo' },
  { code: '0174', name: 'Banplus' },
  { code: '0175', name: 'Bicentenario del Pueblo' },
  { code: '0177', name: 'Banfanb' },
  { code: '0191', name: 'BNC Nacional de Crédito' },
  { code: '0601', name: 'Instituto Municipal de Crédito Popular' },
];

/**
 * Devuelve la etiqueta completa "<code> - <name>" para mostrar en UI.
 */
export const getBankLabel = (code: string): string => {
  const bank = VENEZUELAN_BANKS.find((b) => b.code === code);
  return bank ? `${bank.code} - ${bank.name}` : code;
};

/** Nombre del banco a partir de su código SUDEBAN ("0102" → "Banco de Venezuela (BDV)"). */
export function nombreBanco(code: string): string {
  return VENEZUELAN_BANKS.find((b) => b.code === code)?.name ?? code;
}
