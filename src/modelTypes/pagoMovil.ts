export interface PagoMovil {
  id: string;
  orderId: string;
  referenceNumber: string;
  cedulaPagador?: string; // Cédula del pagador
  bancoOrigen?: string; // Código del banco origen
  fechaPago?: string; // Fecha del pago "YYYY-MM-DD"
  expectedAmount: number; // Monto esperado en USD (legacy)
  expectedAmountBS?: number; // Monto esperado en Bolívares
  expectedAmountUSD?: number; // Monto esperado en USD
  actualAmount?: number; // Monto real encontrado en Bolívares
  actualAmountUSD?: number; // Monto real en USD (calculado)
  phoneNumber: string;
  status: 'pending' | 'verified' | 'amount_mismatch' | 'not_found' | 'error';
  verificationDate: Date;
  errorMessage?: string;
  bcvRate?: number; // Tasa BCV usada en el momento de verificación
  createdAt: Date;
  updatedAt: Date;
}

export interface PagoMovilVerificationRequest {
  // Campos BDV API Conciliación
  cedulaPagador: string; // e.g. "V12345678"
  telefonoPagador: string; // e.g. "04121234567"
  referencia: string; // número de referencia del pago
  fechaPago: string; // formato "YYYY-MM-DD"
  importe: string; // monto con 2 decimales, e.g. "120.00"
  bancoOrigen: string; // código de banco, e.g. "0102"
  // Legacy — mantener compatibilidad con código existente
  referenceNumber?: string;
  expectedAmount?: string;
  phoneNumber?: string;
}

export interface PagoMovilVerificationResult {
  success: boolean;
  found: boolean;
  amountMatches: boolean;
  actualAmount?: string;
  errorMessage?: string;
}
