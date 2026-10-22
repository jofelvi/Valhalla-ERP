import { IdentificationType } from '../enums/enumShared';

export interface Customer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  identificationId?: string | null;
  identificationType?: IdentificationType | null;
  rif?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date | null;
  linkedUserId?: string | null; // Vínculo con un usuario del sistema (users collection)
  memberAction?: string | null; // N° de acción del club (ej: "00590")
  isMemberPrincipal?: boolean | null; // Dueño de la acción
  nameAliases?: string[] | null; // Nombres anteriores (renombres/fusiones)
  memberCreditLimit?: number | null;
  memberCreditUsed?: number | null;
  memberCreditMonthsPaid?: number | null;
}
