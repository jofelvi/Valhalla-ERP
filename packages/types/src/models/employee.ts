export type EmployeeDocumentType =
  | 'cedula'
  | 'rif'
  | 'permiso_alimentos'
  | 'certificado_medico'
  | 'carnet_salud'
  | 'antecedentes_penales'
  | 'otro';

export interface EmployeeDocument {
  id: string;
  type: EmployeeDocumentType;
  name: string;
  url: string;
  expiryDate?: string | null;
  uploadedAt: string;
  notes?: string | null;
}

export interface EmployeeMedicalInfo {
  bloodType?: string | null;
  allergies?: string | null;
  conditions?: string | null;
  notes?: string | null;
}

export interface Employee {
  id: string;
  userId?: string; // Relación con User para login
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  position: string;
  department: string;
  hireDate: Date;
  salary: number;
  isActive: boolean;
  esMesonero?: boolean; // true = cobra por comisiones; false = sueldo base
  pin: string | null; // PIN de seguridad para registro de asistencia
  customerId?: string; // Relación con Customer
  photoUrl?: string | null;
  observations?: string | null;
  medicalInfo?: EmployeeMedicalInfo | null;
  documents?: EmployeeDocument[] | null;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  bankAccount?: {
    accountNumber: string | null;
    bankName: string | null;
    accountType: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEmployeeData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  position: string;
  department: string;
  hireDate: Date;
  salary: number;
  pin: string | null; // PIN de seguridad para registro de asistencia
  photoUrl?: string | null;
  observations?: string | null;
  medicalInfo?: EmployeeMedicalInfo | null;
  documents?: EmployeeDocument[] | null;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  bankAccount?: {
    accountNumber: string | null;
    bankName: string | null;
    accountType: string | null;
  } | null;
}
