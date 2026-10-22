import { Module } from '@nestjs/common';
import { PosGateway } from './gateways/pos.gateway';
import { PrintGateway } from './gateways/print.gateway';

@Module({
  providers: [PosGateway, PrintGateway],
  exports: [PosGateway, PrintGateway],
})
export class WebsocketsModule {}
