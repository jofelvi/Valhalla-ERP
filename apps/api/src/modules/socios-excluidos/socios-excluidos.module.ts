import { Module } from '@nestjs/common';
import { SociosExcluidosService } from './socios-excluidos.service';
import { SociosExcluidosController } from './socios-excluidos.controller';

@Module({
  providers: [SociosExcluidosService],
  controllers: [SociosExcluidosController],
  exports: [SociosExcluidosService],
})
export class SociosExcluidosModule {}
