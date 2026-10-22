import { Controller, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { SendEmailDto } from './dto/send-email.dto';
import { SendWhatsappDto } from './dto/send-whatsapp.dto';
import { SendPagoPendienteDto } from './dto/send-pago-pendiente.dto';
import { SendBudgetDto } from './dto/send-budget.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@odin6/types';

@ApiTags('notifications')
@Controller('api/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('email/welcome')
  @HttpCode(200)
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Send welcome email (ADMIN, MANAGER)' })
  @ApiResponse({ status: 200, description: 'Email queued successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async sendWelcomeEmail(@Body() sendEmailDto: SendEmailDto) {
    return this.notificationsService.sendWelcomeEmail(sendEmailDto);
  }

  @Post('whatsapp/send')
  @HttpCode(200)
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Send WhatsApp message (ADMIN, MANAGER)' })
  @ApiResponse({ status: 200, description: 'Message queued successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async sendWhatsapp(@Body() sendWhatsappDto: SendWhatsappDto) {
    return this.notificationsService.sendWhatsapp(sendWhatsappDto);
  }

  @Post('pago-pendiente')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send pago_pendiente template with PDF attached' })
  @ApiResponse({ status: 200, description: 'Template sent successfully' })
  @ApiResponse({ status: 502, description: 'WhatsApp service error' })
  async sendPagoPendiente(@Body() dto: SendPagoPendienteDto) {
    return this.notificationsService.sendPagoPendiente(dto);
  }

  @Post('budget')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Send a budget over WhatsApp with the PDF attached',
  })
  @ApiResponse({
    status: 200,
    description: 'Budget sent (template or plain text)',
  })
  @ApiResponse({ status: 502, description: 'WhatsApp service error' })
  async sendBudget(@Body() dto: SendBudgetDto) {
    return this.notificationsService.sendBudget(dto);
  }
}
