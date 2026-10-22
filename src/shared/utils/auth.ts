import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { AUTH_ROUTES } from '@/shared/constantsRoutes/routes';
import { useUserStore } from '@/shared/store/useUserStore';
import { UserRoleEnum } from '@/shared/types/enumShared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/** Margen para renovar antes de que expire (el backend firma a 30 dias). */
const RENOVAR_SI_QUEDA_MENOS_DE_MS = 3 * 24 * 60 * 60 * 1000; // 3 dias

/** Lee el `exp` del JWT sin verificar firma (solo para saber cuando vence). */
function vencimientoDelToken(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(
      Buffer.from(
        payload.replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      ).toString('utf8'),
    ) as { exp?: number };
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Renueva el accessToken del backend cuando esta cerca de expirar.
 *
 * `/api/auth/refresh` exige un token AUN VALIDO, asi que hay que adelantarse:
 * si ya expiro no hay nada que hacer y se devuelve tal cual (el API respondera
 * 401 y el cliente forzara re-login).
 */
async function renovarTokenSiHaceFalta(
  actual: string | undefined,
): Promise<string | undefined> {
  if (!actual) return actual;

  const vence = vencimientoDelToken(actual);
  if (vence === null) return actual;

  const restante = vence - Date.now();
  if (restante > RENOVAR_SI_QUEDA_MENOS_DE_MS) return actual; // aun sobra
  if (restante <= 0) return actual; // ya expiro: refresh no puede renovarlo

  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${actual}`,
      },
    });
    if (!res.ok) return actual;
    const data = (await res.json()) as { accessToken?: string };
    return data.accessToken ?? actual;
  } catch {
    return actual; // best-effort: no romper la sesion por un fallo de red
  }
}

// Autenticación contra NestJS backend
async function signInWithNestJS(email: string, password: string) {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Authentication failed');
  }

  return response.json();
}

export function isAuthenticated() {
  const { user } = useUserStore.getState();
  return !!user;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const data = await signInWithNestJS(
            credentials.email,
            credentials.password,
          );

          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name || credentials.email.split('@')[0],
            image: data.user.image || '',
            role: data.user.role || 'customer',
            accessToken: data.accessToken,
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  pages: {
    signIn: AUTH_ROUTES.SIGNIN,
  },
  callbacks: {
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      session.user.role = token.role as UserRoleEnum;
      // Pasar el accessToken de NestJS a la sesión del cliente
      const sessionWithToken = session as typeof session & {
        accessToken?: string;
      };
      sessionWithToken.accessToken = token.accessToken as string | undefined;
      return session;
    },
    async jwt({ token, account, user }) {
      if (account) {
        token.id = account.providerAccountId;
      }

      if (user) {
        const u = user as {
          role?: string;
          name?: string;
          image?: string;
          accessToken?: string;
        };
        if (u.role) token.role = u.role;
        if (u.name) token.name = u.name;
        if (u.image) token.picture = u.image;
        if (u.accessToken) token.accessToken = u.accessToken;
      }

      if (!token.role) {
        token.role = UserRoleEnum.CUSTOMER;
      }

      // El accessToken del backend se tomaba SOLO al iniciar sesion y nunca se
      // renovaba, mientras la sesion de NextAuth si se auto-renueva con el uso.
      // Resultado: sesion viva con token del backend caducado — el API lo
      // rechazaba, pero al estar los guards en modo permisivo nada fallaba y
      // nadie se enteraba. Aqui se renueva ANTES de que expire (el endpoint
      // /auth/refresh exige un token todavia valido).
      token.accessToken = await renovarTokenSiHaceFalta(
        token.accessToken as string | undefined,
      );

      return token;
    },
  },
};
