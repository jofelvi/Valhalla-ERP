import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mailer';
import { buildWelcomeEmail } from '@/lib/emailTemplates';
import { obtenerConfigPublica } from '@/lib/configServidor';
import { nombreVisible } from '@odin6/types';

interface WelcomeRequest {
  customerId: string;
  name: string;
  email: string;
  creditLimit: number;
  isMember: boolean;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as WelcomeRequest;

    if (!body.email || !body.name) {
      return NextResponse.json(
        { success: false, error: 'Email y nombre son requeridos' },
        { status: 400 },
      );
    }

    const { marca, negocio } = await obtenerConfigPublica();
    const nombre = nombreVisible(marca, negocio);
    const html = buildWelcomeEmail({
      name: body.name,
      creditLimit: body.creditLimit || 0,
      isMember: body.isMember || false,
      contexto: { negocio, marca },
    });

    const sent = await sendEmail({
      to: body.email,
      subject: body.isMember
        ? `Bienvenido al club, ${body.name.split(' ')[0]}! - ${nombre}`
        : `Bienvenido a ${nombre}, ${body.name.split(' ')[0]}!`,
      html,
      fromName: nombre,
    });

    if (!sent) {
      return NextResponse.json(
        { success: false, error: 'Error al enviar el email' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /email/welcome] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
