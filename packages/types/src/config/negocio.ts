import { asRecord, str, url } from './util';

export interface PagoMovilNegocio {
  /** Código de banco de 4 cifras (ej. "0102"). */
  bank: string;
  phone: string;
  /** Cédula o RIF del titular. */
  documentId: string;
}

export interface TransferenciaNegocio {
  bank: string;
  account: string;
  holder: string;
  documentId: string;
}

/** Datos del negocio del cliente: salen en recibos, facturas, PDFs, correos y mensajes. */
export interface NegocioConfig {
  /** Nombre comercial. Vacío = instalación sin configurar. */
  tradeName: string;
  /** Subtítulo bajo el nombre en el ticket (ej. "Restaurante & Bar"). */
  tagline: string;
  /** Razón social para facturas fiscales. */
  legalName: string;
  /** RIF / NIT / identificación fiscal. */
  taxId: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  instagram: string;
  /** Texto legal al pie de facturas / política de privacidad. */
  legalText: string;
  /** Mensaje de agradecimiento al pie del ticket. */
  receiptFooter: string;
  /** Destinatario de las alertas operativas (impresora caída, informes). */
  alertsEmail: string;
  mobilePayment: PagoMovilNegocio | null;
  bankTransfer: TransferenciaNegocio | null;
}

export const NEGOCIO_DEFAULT: NegocioConfig = {
  tradeName: '',
  tagline: '',
  legalName: '',
  taxId: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  instagram: '',
  legalText: '',
  receiptFooter: 'Gracias por su preferencia',
  alertsEmail: '',
  mobilePayment: null,
  bankTransfer: null,
};

export function normalizeNegocio(raw: unknown): NegocioConfig {
  const r = asRecord(raw);
  const d = NEGOCIO_DEFAULT;
  const pm = asRecord(r.mobilePayment);
  const bt = asRecord(r.bankTransfer);
  const mobilePayment: PagoMovilNegocio | null =
    r.mobilePayment && (str(pm.phone, '') || str(pm.bank, ''))
      ? {
          bank: str(pm.bank, '', 8),
          phone: str(pm.phone, '', 30),
          documentId: str(pm.documentId, '', 30),
        }
      : null;
  const bankTransfer: TransferenciaNegocio | null =
    r.bankTransfer && str(bt.account, '')
      ? {
          bank: str(bt.bank, '', 80),
          account: str(bt.account, '', 40),
          holder: str(bt.holder, '', 120),
          documentId: str(bt.documentId, '', 30),
        }
      : null;
  return {
    tradeName: str(r.tradeName, d.tradeName, 80),
    tagline: str(r.tagline, d.tagline, 80),
    legalName: str(r.legalName, d.legalName, 120),
    taxId: str(r.taxId, d.taxId, 30),
    address: str(r.address, d.address, 200),
    phone: str(r.phone, d.phone, 40),
    email: str(r.email, d.email, 120),
    website: url(r.website, d.website),
    instagram: str(r.instagram, d.instagram, 60),
    legalText: str(r.legalText, d.legalText, 2000),
    receiptFooter: str(r.receiptFooter, d.receiptFooter, 120),
    alertsEmail: str(r.alertsEmail, d.alertsEmail, 120),
    mobilePayment,
    bankTransfer,
  };
}
