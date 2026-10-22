// features/auth/AuthForm.tsx

'use client';

import { useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { api } from '@/services/api/apiClient';
import { useRouter } from 'next/navigation';
import * as yup from 'yup';
import { loginSchema, registerSchema } from '@/shared/schemas/userSchema';
import { Input } from '../shared/input/input';
import { BrandLogo } from '@/shared/ui/brand/BrandLogo';
import { Button } from '@/components/shared/button/Button';
import { signIn } from 'next-auth/react';
import { PUBLIC_ROUTES } from '@/shared';
import { useNombreApp } from '@/shared/config';

// Infer types from schemas
type LoginInput = yup.InferType<typeof loginSchema>;
type RegisterInput = yup.InferType<typeof registerSchema>;

export function AuthForm() {
  const nombre = useNombreApp();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorLogin, setFirebaseError] = useState<string | null>(null);
  const router = useRouter();

  const currentSchema = isLogin ? loginSchema : registerSchema;
  type FormValues = LoginInput | RegisterInput;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: yupResolver(currentSchema),
  });

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    setLoading(true);
    setFirebaseError(null);

    try {
      if (isLogin) {
        // Use NextAuth signIn for login
        const result = await signIn('credentials', {
          email: (data as LoginInput).email,
          password: (data as LoginInput).password,
          redirect: false,
        });

        if (result?.error) {
          setFirebaseError('El email o la contraseña son incorrectos.');
        } else {
          // Redirect will be handled by root page based on user role
          router.push(PUBLIC_ROUTES.ROOT);
        }
      } else {
        // Registro via NestJS backend
        const regData = data as RegisterInput;
        await api.post('/api/auth/register', {
          name: regData.name,
          email: regData.email,
          password: regData.password,
        });
        // Auto-login después de registrar
        const result = await signIn('credentials', {
          email: regData.email,
          password: regData.password,
          redirect: false,
        });
        if (!result?.error) {
          router.push(PUBLIC_ROUTES.ROOT);
        }
      }
    } catch (error: unknown) {
      // Log para debugging
      console.error('Auth error:', error);

      // Mapea códigos de error de Firebase a mensajes amigables
      const errorLogin = error as { code?: string; message?: string };
      const errorCode = errorLogin.code;
      let message =
        errorLogin.message || 'Ocurrió un error. Inténtalo de nuevo.';

      if (
        errorCode === 'auth/user-not-found' ||
        errorCode === 'auth/wrong-password' ||
        errorCode === 'auth/invalid-credential'
      ) {
        message = 'El email o la contraseña son incorrectos.';
      } else if (errorCode === 'auth/email-already-in-use') {
        message = 'Este email ya está registrado.';
      } else if (errorCode === 'auth/invalid-api-key') {
        message = 'Error de configuración. Contacta al administrador.';
      } else if (errorCode === 'auth/network-request-failed') {
        message = 'Error de red. Verifica tu conexión.';
      }
      setFirebaseError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      {/* Columna de la imagen (Hero/Branding) - Oculta en móviles */}
      <div className="hidden md:block md:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand/10 to-brand-light/10 z-10"></div>
        <div className="absolute inset-0 flex items-center justify-center bg-surface">
          <BrandLogo className="scale-150" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-page/80 to-transparent z-20"></div>
      </div>

      {/* Columna del Formulario */}
      <div className="flex w-full items-center justify-center p-6 md:w-1/2 relative">
        <div className="absolute inset-0 bg-surface/60 backdrop-blur-sm"></div>
        <div className="w-full max-w-md space-y-6 relative z-10">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-brand to-accent rounded-2xl flex items-center justify-center shadow-xl shadow-brand/25 mb-6">
              <svg
                className="w-8 h-8 text-on-brand"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-brand to-brand-light bg-clip-text text-transparent">
              {isLogin ? 'Bienvenido de Nuevo' : 'Crea tu Cuenta'}
            </h1>
            <p className="mt-2 text-sm text-dim/80 font-medium">
              {isLogin
                ? `Ingresa tus credenciales para acceder a ${nombre}`
                : `Completa el formulario para unirte a ${nombre}`}
            </p>
          </div>

          {/* method="post": si se pulsa "Ingresar" antes de que cargue el
              JavaScript, el navegador envia el formulario solo. Sin method
              lo hacia por GET y la contraseña quedaba en la URL (historial
              y logs de nginx). Visto en PRE el 26/09/2026. */}
          <form
            method="post"
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
          >
            {!isLogin && (
              <div>
                <Input
                  id="name"
                  label="Nombre"
                  type="text"
                  {...register('name')}
                  className="mt-1 block w-full rounded-xl border-line bg-surface/80 backdrop-blur-sm shadow-sm focus:border-brand focus:ring-brand focus:ring-2 focus:ring-offset-0 sm:text-sm transition-all duration-200"
                />
                {/*  {errors?.name && (
                  <p className="mt-1 text-xs text-danger">
                    {errors.name.message}
                  </p>
                )}*/}
              </div>
            )}

            <div>
              <Input
                label={'Email'}
                id="email"
                type="email"
                {...register('email')}
                className="mt-1 block w-full rounded-xl border-line bg-surface/80 backdrop-blur-sm shadow-sm focus:border-brand focus:ring-brand focus:ring-2 focus:ring-offset-0 sm:text-sm transition-all duration-200"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-danger">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <Input
                id="password"
                type="password"
                label="Contraseña"
                {...register('password')}
                className="mt-1 block w-full rounded-xl border-line bg-surface/80 backdrop-blur-sm shadow-sm focus:border-brand focus:ring-brand focus:ring-2 focus:ring-offset-0 sm:text-sm transition-all duration-200"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-danger">
                  {errors.password.message}
                </p>
              )}
            </div>

            {errorLogin && (
              <div className="text-sm text-danger bg-gradient-to-r from-red-50 to-pink-50 border border-danger p-4 rounded-xl backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-danger"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {errorLogin}
                </div>
              </div>
            )}

            <div>
              <Button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-xl border border-transparent bg-gradient-to-r from-brand to-brand-light py-3 px-6 text-sm font-semibold text-on-brand shadow-lg shadow-brand/30 hover:from-brand-dark hover:to-brand focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:opacity-50 transition-all duration-200 transform hover:scale-[1.02]"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Cargando...
                  </div>
                ) : isLogin ? (
                  'Ingresar'
                ) : (
                  'Registrarse'
                )}
              </Button>
            </div>
          </form>
          <Button
            onClick={() =>
              signIn('google', { callbackUrl: PUBLIC_ROUTES.ROOT })
            }
            className="flex w-full justify-center items-center gap-3 rounded-xl border border-line bg-surface/80 backdrop-blur-sm py-3 px-6 text-sm font-semibold text-dim shadow-lg hover:bg-surface hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 transition-all duration-200 transform hover:scale-[1.02]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continuar con Google
          </Button>
          <div className="text-center text-sm">
            <Button
              variant="ghost"
              onClick={() => {
                setIsLogin(!isLogin);
                setFirebaseError(null);
              }}
              className="font-semibold text-brand hover:text-dim hover:bg-elevated rounded-xl px-4 py-2 transition-all duration-200"
            >
              {isLogin
                ? '¿No tienes una cuenta? Regístrate'
                : '¿Ya tienes una cuenta? Ingresa'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
