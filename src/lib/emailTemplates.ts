import type { ContextoPdf } from '@/shared/utils/pdfGenerator';

interface WelcomeEmailData {
  name: string;
  creditLimit: number;
  isMember: boolean;
  /** Negocio y marca del cliente: nombre, colores, dirección y redes salen de aquí. */
  contexto: ContextoPdf;
}

/** Plantilla de bienvenida. Los colores son los de la paleta clara de la marca. */
export function buildWelcomeEmail({
  name,
  creditLimit,
  isMember,
  contexto,
}: WelcomeEmailData): string {
  const { negocio, marca } = contexto;
  const p = marca.palette.light;
  const nombre = marca.appName || negocio.tradeName || 'Punto de venta';
  const firstName = name.split(' ')[0];

  const creditSection =
    isMember && creditLimit > 0
      ? `
      <div style="background: ${p.primary}; border-radius: 16px; padding: 24px; text-align: center; margin: 24px 0;">
        <p style="color: ${p.onPrimary}; font-size: 14px; margin: 0 0 8px 0;">Tu credito disponible</p>
        <p style="color: ${p.onPrimary}; font-size: 42px; font-weight: 800; margin: 0; letter-spacing: -1px;">$${creditLimit}</p>
        <p style="color: ${p.onPrimary}; font-size: 13px; margin: 8px 0 0 0;">Usalo en tu proxima visita</p>
      </div>
    `
      : '';

  const memberBadge = isMember
    ? `<span style="background: ${p.primary}; color: ${p.onPrimary}; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">Socio del Club</span>`
    : '';

  const web = negocio.website
    ? `<a href="${negocio.website}" style="color: ${p.primary}; text-decoration: none;">Web</a>`
    : '';
  const instagram = negocio.instagram
    ? `<a href="https://instagram.com/${negocio.instagram.replace(/^@/, '')}" style="color: ${p.primary}; text-decoration: none;">Instagram</a>`
    : '';
  const enlaces = [web, instagram].filter(Boolean).join('&nbsp;·&nbsp;');
  const direccion = [nombre, negocio.address].filter(Boolean).join(' · ');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: ${p.page}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">

    <!-- Header -->
    <div style="background: ${p.sidebar}; border-radius: 20px 20px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: ${p.primary}; font-size: 28px; font-weight: 800; margin: 0;">${nombre}</h1>
      ${negocio.tagline ? `<p style="color: ${p.dim}; font-size: 13px; margin: 8px 0 0 0;">${negocio.tagline}</p>` : ''}
    </div>
    <!-- Body -->
    <div style="background: ${p.surface}; padding: 32px; border-radius: 0 0 20px 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        ${memberBadge}
      </div>
      <h2 style="color: ${p.content}; font-size: 24px; font-weight: 700; margin: 0 0 16px 0;">
        Hola ${firstName}!
      </h2>
      <p style="color: ${p.dim}; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
        Bienvenido a <strong>${nombre}</strong>. Tu cuenta ha sido creada exitosamente.
      </p>
      ${creditSection}
      <p style="color: ${p.dim}; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
        Desde la app puedes:
      </p>
      <div style="margin: 0 0 24px 0;">
        <p style="color: ${p.content}; font-size: 14px; margin: 0 0 12px 0;">Hacer pedidos desde tu mesa</p>
        <p style="color: ${p.content}; font-size: 14px; margin: 0 0 12px 0;">Recibir promos exclusivas</p>
        ${isMember ? `<p style="color: ${p.content}; font-size: 14px; margin: 0 0 12px 0;">Pagar con tu credito de socio</p>` : ''}
      </div>
    </div>
    <!-- Footer -->
    <div style="text-align: center; padding: 24px;">
      <p style="color: ${p.dim}; font-size: 12px; margin: 0;">${direccion}</p>
      ${enlaces ? `<p style="color: ${p.dim}; font-size: 12px; margin: 8px 0 0 0;">${enlaces}</p>` : ''}
    </div>
  </div>
</body>
</html>
  `.trim();
}
