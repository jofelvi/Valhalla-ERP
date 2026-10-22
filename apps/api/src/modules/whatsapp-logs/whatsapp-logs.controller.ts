import {
  Body,
  Controller,
  Get,
  Headers,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { WhatsappLogsService } from './whatsapp-logs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@odin6/types';
import type { WhatsappMessageStatus } from './schemas/whatsapp-message-log.schema';

/**
 * Payload minimo que nos interesa de los webhooks de Meta Cloud API.
 * Ref: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
 */
interface MetaWebhookStatus {
  id: string; // wamid
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: Array<{
    code: number;
    title: string;
    message?: string;
    error_data?: { details?: string };
  }>;
}

interface MetaWebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        statuses?: MetaWebhookStatus[];
      };
    }>;
  }>;
}

@ApiTags('whatsapp-logs')
@Controller('api')
export class WhatsappLogsController {
  private readonly logger = new Logger(WhatsappLogsController.name);

  constructor(
    private readonly service: WhatsappLogsService,
    private readonly config: ConfigService,
  ) {}

  // ─── Consultas (protegidas JWT) ─────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @Get('whatsapp-logs')
  @ApiOperation({ summary: 'Listar logs WhatsApp (ADMIN, MANAGER)' })
  async list(
    @Query('accountId') accountId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const filter: Record<string, unknown> = {};
    if (accountId) filter.accountReceivableId = accountId;
    if (status) filter.status = status;
    const max = Math.min(Number(limit) || 100, 500);
    const items = await this.service.findRecent(max, filter);
    const stats = await this.service.stats();
    return { items, stats };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @Get('whatsapp-logs/by-account/:accountId')
  async byAccount(@Query('accountId') accountId: string) {
    const items = await this.service.findByAccount(accountId, 20);
    return { items };
  }

  // ─── Webhook Meta (verificacion GET + eventos POST) ──────────
  // Endpoint publico, autenticado por verify token + signature.

  @Get('webhooks/whatsapp')
  @ApiOperation({ summary: 'Verificacion de webhook (Meta)' })
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const expected = this.config.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN');
    if (mode === 'subscribe' && token && expected && token === expected) {
      this.logger.log('webhook verify OK');
      return res.status(200).send(challenge);
    }
    this.logger.warn(
      `webhook verify FAIL (mode=${mode}, tokenMatch=${token === expected})`,
    );
    return res.status(403).send('forbidden');
  }

  @Post('webhooks/whatsapp')
  @ApiOperation({ summary: 'Eventos de estado de mensajes (Meta)' })
  async event(
    @Body() body: MetaWebhookPayload,
    @Headers('x-hub-signature-256') _sig: string,
    @Req() _req: Request,
    @Res() res: Response,
  ) {
    try {
      const entries = body?.entry ?? [];
      let processed = 0;
      for (const e of entries) {
        for (const c of e.changes ?? []) {
          const statuses = c.value?.statuses ?? [];
          for (const st of statuses) {
            const mapped = this.mapStatus(st.status);
            const ts = Number(st.timestamp);
            const date =
              isFinite(ts) && ts > 0 ? new Date(ts * 1000) : new Date();
            const firstErr = st.errors?.[0];
            await this.service.updateStatus({
              messageId: st.id,
              status: mapped,
              timestamp: date,
              errorCode: firstErr?.code,
              errorTitle: firstErr?.title,
              errorMessage: firstErr?.message ?? firstErr?.error_data?.details,
              raw: st as unknown as Record<string, unknown>,
            });
            processed++;
          }
        }
      }
      this.logger.log(`webhook processed ${processed} status events`);
      return res.status(200).json({ success: true, processed });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      this.logger.error(`webhook error: ${msg}`);
      // Siempre 200 para evitar reintentos agresivos de Meta
      return res.status(200).json({ success: false, error: msg });
    }
  }

  private mapStatus(s: string): WhatsappMessageStatus {
    if (s === 'sent') return 'sent';
    if (s === 'delivered') return 'delivered';
    if (s === 'read') return 'read';
    if (s === 'failed') return 'failed';
    return 'unknown';
  }
}
