import * as yup from 'yup';
import type { NegocioConfig } from '@odin6/types';

/** Valores del formulario: planos, para que React Hook Form los maneje sin anidar. */
export interface NegocioFormulario {
  tradeName: string;
  tagline: string;
  legalName: string;
  taxId: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  instagram: string;
  legalText: string;
  receiptFooter: string;
  alertsEmail: string;
  pagoMovilActivo: boolean;
  pmBank: string;
  pmPhone: string;
  pmDocumentId: string;
  transferenciaActiva: boolean;
  btBank: string;
  btAccount: string;
  btHolder: string;
  btDocumentId: string;
}

export function aFormulario(n: NegocioConfig): NegocioFormulario {
  return {
    tradeName: n.tradeName,
    tagline: n.tagline,
    legalName: n.legalName,
    taxId: n.taxId,
    address: n.address,
    phone: n.phone,
    email: n.email,
    website: n.website,
    instagram: n.instagram,
    legalText: n.legalText,
    receiptFooter: n.receiptFooter,
    alertsEmail: n.alertsEmail,
    pagoMovilActivo: n.mobilePayment !== null,
    pmBank: n.mobilePayment?.bank ?? '',
    pmPhone: n.mobilePayment?.phone ?? '',
    pmDocumentId: n.mobilePayment?.documentId ?? '',
    transferenciaActiva: n.bankTransfer !== null,
    btBank: n.bankTransfer?.bank ?? '',
    btAccount: n.bankTransfer?.account ?? '',
    btHolder: n.bankTransfer?.holder ?? '',
    btDocumentId: n.bankTransfer?.documentId ?? '',
  };
}

/** Documento completo a guardar. Un pago apagado se guarda como `null` (lo borra). */
export function aValor(f: NegocioFormulario): NegocioConfig {
  return {
    tradeName: f.tradeName.trim(),
    tagline: f.tagline.trim(),
    legalName: f.legalName.trim(),
    taxId: f.taxId.trim(),
    address: f.address.trim(),
    phone: f.phone.trim(),
    email: f.email.trim(),
    website: f.website.trim(),
    instagram: f.instagram.trim(),
    legalText: f.legalText.trim(),
    receiptFooter: f.receiptFooter.trim(),
    alertsEmail: f.alertsEmail.trim(),
    mobilePayment: f.pagoMovilActivo
      ? {
          bank: f.pmBank.trim(),
          phone: f.pmPhone.trim(),
          documentId: f.pmDocumentId.trim(),
        }
      : null,
    bankTransfer: f.transferenciaActiva
      ? {
          bank: f.btBank.trim(),
          account: f.btAccount.trim(),
          holder: f.btHolder.trim(),
          documentId: f.btDocumentId.trim(),
        }
      : null,
  };
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const correo = yup
  .string()
  .defined()
  .trim()
  .max(120, 'El correo no puede pasar de 120 caracteres.')
  .test(
    'correo',
    'Revise el correo: debe verse como nombre@dominio.com.',
    (v) => !v || CORREO.test(v),
  );

const web = yup
  .string()
  .defined()
  .trim()
  .max(200, 'La web no puede pasar de 200 caracteres.')
  .test(
    'web',
    'La web debe empezar con https:// (ej. https://minegocio.com).',
    (v) => !v || /^https?:\/\/\S+$/.test(v),
  );

export const negocioEsquema = yup.object({
  tradeName: yup
    .string()
    .defined()
    .trim()
    .required('Escriba el nombre comercial.')
    .max(80, 'El nombre comercial no puede pasar de 80 caracteres.'),
  tagline: yup.string().defined().trim().max(80, 'Máximo 80 caracteres.'),
  legalName: yup.string().defined().trim().max(120, 'Máximo 120 caracteres.'),
  taxId: yup.string().defined().trim().max(30, 'Máximo 30 caracteres.'),
  address: yup.string().defined().trim().max(200, 'Máximo 200 caracteres.'),
  phone: yup.string().defined().trim().max(40, 'Máximo 40 caracteres.'),
  email: correo,
  website: web,
  instagram: yup.string().defined().trim().max(60, 'Máximo 60 caracteres.'),
  legalText: yup
    .string()
    .defined()
    .trim()
    .max(2000, 'El texto legal no puede pasar de 2000 caracteres.'),
  receiptFooter: yup
    .string()
    .defined()
    .trim()
    .max(120, 'Máximo 120 caracteres.'),
  alertsEmail: correo,
  pagoMovilActivo: yup.boolean().defined(),
  pmBank: yup
    .string()
    .defined()
    .trim()
    .when('pagoMovilActivo', {
      is: true,
      then: (s) =>
        s
          .required('Escriba el código del banco de Pago Móvil.')
          .matches(/^\d{4}$/, 'El código del banco son 4 cifras (ej. 0102).'),
    }),
  pmPhone: yup
    .string()
    .defined()
    .trim()
    .when('pagoMovilActivo', {
      is: true,
      then: (s) =>
        s
          .required('Escriba el teléfono de Pago Móvil.')
          .max(30, 'Máximo 30 caracteres.'),
    }),
  pmDocumentId: yup
    .string()
    .defined()
    .trim()
    .when('pagoMovilActivo', {
      is: true,
      then: (s) =>
        s
          .required('Escriba la cédula o RIF del titular.')
          .max(30, 'Máximo 30 caracteres.'),
    }),
  transferenciaActiva: yup.boolean().defined(),
  btBank: yup
    .string()
    .defined()
    .trim()
    .when('transferenciaActiva', {
      is: true,
      then: (s) =>
        s
          .required('Escriba el banco de la transferencia.')
          .max(80, 'Máximo 80 caracteres.'),
    }),
  btAccount: yup
    .string()
    .defined()
    .trim()
    .when('transferenciaActiva', {
      is: true,
      then: (s) =>
        s
          .required('Escriba el número de cuenta.')
          .max(40, 'Máximo 40 caracteres.'),
    }),
  btHolder: yup
    .string()
    .defined()
    .trim()
    .when('transferenciaActiva', {
      is: true,
      then: (s) =>
        s
          .required('Escriba el titular de la cuenta.')
          .max(120, 'Máximo 120 caracteres.'),
    }),
  btDocumentId: yup
    .string()
    .defined()
    .trim()
    .when('transferenciaActiva', {
      is: true,
      then: (s) =>
        s
          .required('Escriba la cédula o RIF del titular.')
          .max(30, 'Máximo 30 caracteres.'),
    }),
});
