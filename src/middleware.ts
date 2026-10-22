import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import {
  pantallaDeInicio,
  redireccionPorAcceso,
} from '@/shared/constantsRoutes/accesoPorRol';

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role as string | undefined;

    // Si es mesonero y trata de entrar al POS principal (grid general de
    // cajero/admin), redirigir a su vista dedicada estilo mobile.
    // Las subrutas /private/pos/order, /private/pos/payment/* SI se usan
    // compartidas para crear ordenes, ver detalle y cobrar.
    if (role === 'waiter' && pathname === '/private/pos') {
      const url = req.nextUrl.clone();
      url.pathname = pantallaDeInicio(role);
      return NextResponse.redirect(url);
    }

    // Quien puede abrir qué vive en `accesoPorRol.ts`, con su prueba al lado.
    // Estaba aquí como listas de texto sueltas y una decía `/private/reportes`
    // —con "e"— cuando la carpeta real es `/private/reports`: la pantalla de
    // reportes, que enseña el ingreso del mes y el catálogo con costos, quedó
    // abierta a mesoneros y estaciones hasta que se midió con Playwright.
    const aDonde = redireccionPorAcceso(pathname, role);
    if (aDonde) {
      const url = req.nextUrl.clone();
      url.pathname = aDonde;
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: '/public/login',
    },
  },
);

export const config = {
  matcher: ['/private/:path*', '/customer/:path*'],
};
