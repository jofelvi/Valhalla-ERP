import { UserRoleEnum } from '@/shared';

export interface User {
  id: string;
  name: string;
  email: string;
  image: string;
  role: UserRoleEnum;
  isActive?: boolean;
}

export interface UserStore {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  setUser: (user: User | null) => void;
}
