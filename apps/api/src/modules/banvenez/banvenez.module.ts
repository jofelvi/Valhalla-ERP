import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BanvenezSessionService } from './banvenez-session.service';

/**
 * Solo la sesion del banco. Sin dependencias de dominio: lo importan
 * pago-movil (verificacion de referencias) y divisas (vigilante de subasta).
 */
@Module({
  imports: [ConfigModule],
  providers: [BanvenezSessionService],
  exports: [BanvenezSessionService],
})
export class BanvenezModule {}
