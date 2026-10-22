import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Valida que las variables de entorno criticas esten configuradas al arrancar.
 * Si faltan, registra un WARN claro (no falla la app, pero se nota en los logs).
 */
@Injectable()
export class EnvValidatorService implements OnModuleInit {
  private readonly logger = new Logger(EnvValidatorService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.validateRequired();
  }

  private validateRequired() {
    const requiredVars: Array<{
      key: string;
      description: string;
      format?: string;
    }> = [
      {
        key: 'DIVISAS_NOTIFY_PHONE',
        description: 'SMS del vigilante de subastas de divisas BDV',
        format: 'E.164 (+<prefijo><número>)',
      },
      {
        key: 'DIVISAS_NOTIFY_EMAIL',
        description: 'Correo del vigilante de subastas de divisas BDV',
        format: 'correo@dominio.com',
      },
      {
        key: 'RESERVATIONS_NOTIFY_PHONE',
        description: 'SMS de alertas de reservas',
        format: 'E.164 (+<prefijo><número>)',
      },
      {
        key: 'WHATSAPP_SERVICE_URL',
        description: 'URL del servicio WhatsApp interno',
        format: 'http://... o https://...',
      },
      {
        key: 'WHATSAPP_API_KEY',
        description: 'Clave API del servicio WhatsApp',
        format: 'token',
      },
    ];

    const missing: string[] = [];

    for (const { key, description, format } of requiredVars) {
      const value = this.config.get<string>(key);
      if (!value || value.trim() === '') {
        missing.push(
          `${key} (${description}${format ? `, formato: ${format}` : ''})`,
        );
      }
    }

    if (missing.length > 0) {
      const list = missing.map((m) => `  - ${m}`).join('\n');
      this.logger.warn(
        `[ENV-VALIDATION] Las siguientes variables NO estan configuradas:\n${list}\n` +
          'Sin estas variables, algunos avisos (SMS, correo, WhatsApp) no se enviaran. ' +
          'La app sigue arrancando, pero revisa el .env de produccion.',
      );
    } else {
      this.logger.log(
        '[ENV-VALIDATION] Todas las variables criticas estan configuradas',
      );
    }
  }
}
