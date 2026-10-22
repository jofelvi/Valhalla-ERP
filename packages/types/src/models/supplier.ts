export interface Supplier {
  id: string;
  name: string;
  contactName?: string | null; // Permitir null y undefined
  phone?: string | null;
  email?: string | null; // Permitir null también aquí
  address?: string | null; // Permitir null también aquí
  createdAt: Date;
  isActive: boolean;
  productIds?: string[]; // IDs de productos que provee
}
