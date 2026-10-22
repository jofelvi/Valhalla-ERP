import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BanvenezModule } from '../banvenez/banvenez.module';
import { SmsService } from '../sms/sms.service';
import { EmailService } from '../sms/email.service';
import { SubastaWatcherService } from './subasta-watcher.service';

/**
 * SmsService y EmailService se declaran aqui en vez de importar SmsModule a
 * proposito: aquel arrastra MongooseModule.forFeature y obligaria al script del
 * vigilante a levantar una conexion a Mongo que no necesita para nada. Ambos
 * servicios solo dependen de ConfigService y no guardan estado.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), BanvenezModule],
  providers: [SubastaWatcherService, SmsService, EmailService],
  exports: [SubastaWatcherService],
})
export class DivisasModule {}
