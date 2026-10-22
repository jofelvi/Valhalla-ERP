'use client';

import { ReactNode } from 'react';
import { EmployeeDocument, EmployeeDocumentType } from '@odin6/types';
import { Badge } from '@/components/ui/badge';
import { AlertTriangleIcon, CheckCircleIcon } from 'lucide-react';

export const DOCUMENT_TYPE_LABELS: Record<EmployeeDocumentType, string> = {
  cedula: 'Cedula de Identidad',
  rif: 'RIF',
  permiso_alimentos: 'Permiso Manipulacion de Alimentos',
  certificado_medico: 'Certificado Medico',
  carnet_salud: 'Carnet de Salud',
  antecedentes_penales: 'Antecedentes Penales',
  otro: 'Otro',
};

export const DOCUMENT_TYPES = Object.keys(
  DOCUMENT_TYPE_LABELS,
) as EmployeeDocumentType[];

export type DocumentStatus =
  | 'vigente'
  | 'por_vencer'
  | 'vencido'
  | 'sin_vencimiento';

export const getDocumentStatus = (doc: EmployeeDocument): DocumentStatus => {
  if (!doc.expiryDate) return 'sin_vencimiento';
  const expiry = new Date(doc.expiryDate);
  const now = new Date();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  if (expiry < now) return 'vencido';
  if (expiry.getTime() - now.getTime() < thirtyDays) return 'por_vencer';
  return 'vigente';
};

export const getStatusBadge = (status: DocumentStatus): ReactNode => {
  switch (status) {
    case 'vigente':
      return (
        <Badge variant="success" className="text-xs">
          <CheckCircleIcon className="h-3 w-3 mr-1" />
          Vigente
        </Badge>
      );
    case 'por_vencer':
      return (
        <Badge variant="warning" className="text-xs">
          <AlertTriangleIcon className="h-3 w-3 mr-1" />
          Por vencer
        </Badge>
      );
    case 'vencido':
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertTriangleIcon className="h-3 w-3 mr-1" />
          Vencido
        </Badge>
      );
    case 'sin_vencimiento':
      return null;
  }
};
