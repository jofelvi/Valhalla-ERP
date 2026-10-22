import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  /** Nombre que ve el destinatario: el del negocio (llega desde la configuración). */
  fromName: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  fromName,
}: SendEmailOptions): Promise<boolean> {
  try {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || '';
    if (!from) {
      console.error('[Mailer] SMTP_FROM no configurado');
      return false;
    }

    await transporter.sendMail({
      from: `"${fromName}" <${from}>`,
      to,
      subject,
      html,
    });

    console.log(`[Mailer] Email enviado a ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error('[Mailer] Error enviando email:', error);
    return false;
  }
}
