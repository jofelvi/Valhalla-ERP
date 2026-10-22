import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientLogsController } from './client-logs.controller';
import { ClientLogsService } from './client-logs.service';
import { ClientLog, ClientLogSchema } from './schemas/client-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ClientLog.name, schema: ClientLogSchema },
    ]),
  ],
  controllers: [ClientLogsController],
  providers: [ClientLogsService],
  exports: [ClientLogsService],
})
export class ClientLogsModule {}
