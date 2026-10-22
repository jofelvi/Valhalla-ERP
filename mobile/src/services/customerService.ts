import { api } from './api/apiClient';
import { Customer } from '../types';

export interface MemberLookup {
  accion: string;
  cedula: string;
  nombre: string;
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  creditMonthsPaid: number;
}

interface UpdateProfileData {
  name?: string;
  phone?: string | null;
  address?: string | null;
}

interface CreateCustomerData {
  name: string;
  lastName?: string;
  cedula?: string;
  phone?: string;
  email?: string;
  memberAction?: string;
  /** Socio dado de alta a mano cuya accion no esta en el padron del club:
   *  queda marcado para revision y sin credito. */
  isUnverifiedMember?: boolean;
}

interface UpdateCustomerData {
  name?: string;
  phone?: string | null;
  email?: string;
}

export const customerService = {
  async updateProfile(
    customerId: string,
    data: UpdateProfileData,
  ): Promise<void> {
    await api.patch(`/api/customers/${customerId}`, data);
  },

  /**
   * Actualiza un cliente (nombre, teléfono, email).
   * Retorna el cliente actualizado.
   */
  async updateCustomer(
    customerId: string,
    data: UpdateCustomerData,
  ): Promise<Customer> {
    return api.patch<Customer>(`/api/customers/${customerId}`, data);
  },

  async search(query: string): Promise<Customer[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    return api.get<Customer[]>(`/api/customers/search`, { q: trimmed });
  },

  async findByMemberAction(action: string): Promise<Customer[]> {
    return api.get<Customer[]>(
      `/api/customers/by-member/${encodeURIComponent(action)}`,
    );
  },

  /**
   * Busca un socio del club en Firestore por numero de accion.
   * Acepta el numero con o sin padding ("590" o "00590"), el backend normaliza a 5 digitos.
   * Lanza si no lo encuentra (HTTP 404).
   */
  async lookupMember(action: string): Promise<MemberLookup> {
    const trimmed = action.trim();
    const res = await api.get<{ success: true; member: MemberLookup }>(
      `/api/members/${encodeURIComponent(trimmed)}`,
    );
    // El backend retorna accion como number, normalizar a string padded para el alias
    const accionStr = String(res.member.accion).padStart(5, '0');
    return { ...res.member, accion: accionStr };
  },

  async create(data: CreateCustomerData): Promise<Customer> {
    return api.post<Customer>('/api/customers', data);
  },

  async getById(id: string): Promise<Customer | null> {
    try {
      return await api.get<Customer>(`/api/customers/${id}`);
    } catch {
      return null;
    }
  },
};
