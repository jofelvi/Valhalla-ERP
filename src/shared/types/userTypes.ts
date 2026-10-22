import { UserRoleEnum } from './enumShared';

export interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
  role: UserRoleEnum;
  isActive: boolean;
}

export interface UserStore {
  user: User | null;
  setUser: (user: User | null) => void;
  login: (user: User) => void;
  logout: () => void;
}
