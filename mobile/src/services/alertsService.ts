import { api } from './api/apiClient';

export type AlertSeverity = 'low' | 'medium' | 'high';

export interface Alert {
  id: string;
  type: 'margin' | 'pending' | 'outOfStock';
  severity: AlertSeverity;
  title: string;
  message: string;
  productId?: string;
  productName?: string;
  value?: number;
}

export interface AlertsResponse {
  margins: Alert[];
  pending: Alert[];
  outOfStock: Alert[];
}

/**
 * Contrato REAL de GET /api/alerts/panel (apps/api AlertsController.panel →
 * AlertasResumen). El endpoint /api/alerts SIN /panel devuelve el formato
 * clásico de la campana web; el Panel del APK usa el estructurado.
 */
type NivelMargen = 'NEGATIVO' | 'NULO' | 'BAJO';

interface RawMargin {
  productId?: string;
  name?: string;
  price?: number;
  cost?: number;
  marginPct?: number;
  nivel?: NivelMargen;
}

interface RawPending {
  productId?: string;
  name?: string;
}

interface RawAlertsPanel {
  margenes?: RawMargin[];
  pendientes?: RawPending[];
  agotados?: unknown[];
}

// NEGATIVO/NULO = se pierde o se vende al costo → alta; BAJO = aviso.
function severityFromNivel(nivel?: NivelMargen): AlertSeverity {
  if (nivel === 'NEGATIVO' || nivel === 'NULO') return 'high';
  return 'medium';
}

function marginToAlert(raw: RawMargin): Alert {
  return {
    id: `margin:${raw.productId ?? ''}`,
    type: 'margin',
    severity: severityFromNivel(raw.nivel),
    title: raw.name ?? 'Producto',
    message:
      raw.nivel === 'NEGATIVO'
        ? `Se pierde en cada venta (margen ${raw.marginPct ?? 0}%)`
        : raw.nivel === 'NULO'
          ? 'Se vende al costo (margen 0%)'
          : `Margen bajo (${raw.marginPct ?? 0}%)`,
    productId: raw.productId,
    productName: raw.name,
    value: raw.marginPct,
  };
}

function pendingToAlert(raw: RawPending): Alert {
  return {
    id: `pending:${raw.productId ?? ''}`,
    type: 'pending',
    severity: 'medium',
    title: raw.name ?? 'Producto',
    message:
      'Se vende sin descontar nada: falta decir si es insumo, preparado o servicio.',
    productId: raw.productId,
    productName: raw.name,
  };
}

export const alertsService = {
  /**
   * Alertas del sistema para el Panel del admin (márgenes en riesgo,
   * naturaleza pendiente, agotados). Usa el endpoint estructurado /panel.
   */
  async getAlerts(): Promise<AlertsResponse> {
    const raw = await api.get<RawAlertsPanel>('/api/alerts/panel');
    return {
      margins: (raw.margenes ?? []).map(marginToAlert),
      pending: (raw.pendientes ?? []).map(pendingToAlert),
      outOfStock: [],
    };
  },
};
