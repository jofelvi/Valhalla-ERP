import { api } from './api/apiClient';
import { toSafeDate } from './dateUtils';
import { Category } from '../types';

interface RawCategory {
  id?: string;
  _id?: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  imageUrl?: string | null;
  isForSale?: boolean;
  parentId?: string;
  createdAt?: string;
  updatedAt?: string;
}

const normalize = (raw: RawCategory): Category => ({
  id: String(raw.id ?? raw._id ?? ''),
  name: raw.name,
  description: raw.description ?? null,
  isActive: raw.isActive ?? true,
  imageUrl: raw.imageUrl ?? null,
  isForSale: raw.isForSale ?? true,
  parentId: raw.parentId ?? undefined,
  createdAt: toSafeDate(raw.createdAt),
  updatedAt: toSafeDate(raw.updatedAt),
});

const sortByName = (a: Category, b: Category) =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : 0;

export const categoryService = {
  async getActiveCategories(): Promise<Category[]> {
    const list = await api.get<RawCategory[]>('/api/categories');
    return list
      .map(normalize)
      .filter((c) => c.isActive && c.isForSale)
      .sort(sortByName);
  },

  async getAll(): Promise<Category[]> {
    const list = await api.get<RawCategory[]>('/api/categories');
    return list.map(normalize).sort(sortByName);
  },
};
