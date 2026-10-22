import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  WhatsappMessageLog,
  WhatsappMessageLogSchema,
} from './schemas/whatsapp-message-log.schema';
import { WhatsappLogsService } from './whatsapp-logs.service';
import { WhatsappLogsController } from './whatsapp-logs.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WhatsappMessageLog.name, schema: WhatsappMessageLogSchema },
    ]),
  ],
  providers: [WhatsappLogsService],
  controllers: [WhatsappLogsController],
  exports: [WhatsappLogsService],
})
export class WhatsappLogsModule {}
