import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModuloActivoGuard } from '../../common/modulos/modulo-activo.guard';
import { RequiereModulo } from '../../common/modulos/requiere-modulo.decorator';

@ApiTags('chat')
@Controller('api/chat')
@UseGuards(JwtAuthGuard, ModuloActivoGuard)
@RequiereModulo('connectedTable')
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({ summary: 'Crear chat (idempotente por orderId)' })
  @ApiResponse({ status: 201, description: 'Chat creado u obtenido' })
  createOrGet(@Body() dto: CreateChatDto) {
    return this.chatService.createOrGet(dto);
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Obtener chat por orderId' })
  getByOrderId(@Param('orderId') orderId: string) {
    return this.chatService.getByOrderId(orderId);
  }

  @Post(':orderId/messages')
  @ApiOperation({ summary: 'Enviar mensaje al chat' })
  sendMessage(@Param('orderId') orderId: string, @Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(orderId, dto);
  }

  @Patch(':orderId/close')
  @ApiOperation({ summary: 'Cerrar chat' })
  close(@Param('orderId') orderId: string) {
    return this.chatService.close(orderId);
  }
}
