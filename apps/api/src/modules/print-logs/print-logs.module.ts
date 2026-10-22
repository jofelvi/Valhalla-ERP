import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PrintLogsService } from './print-logs.service';
import { PrintLogsController } from './print-logs.controller';
import { PrintLog, PrintLogSchema } from './schemas/print-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PrintLog.name, schema: PrintLogSchema },
    ]),
  ],
  providers: [PrintLogsService],
  controllers: [PrintLogsController],
  exports: [PrintLogsService],
})
export class PrintLogsModule {}
