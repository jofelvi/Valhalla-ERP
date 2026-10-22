import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigsService } from './configs.service';
import { ConfigsController } from './configs.controller';
import { Config, ConfigSchema } from './schemas/config.schema';

/**
 * Global: cualquier módulo inyecta `ConfigsService` sin importar este. Es la única puerta de
 * lectura de la configuración del negocio.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Config.name, schema: ConfigSchema }]),
  ],
  controllers: [ConfigsController],
  providers: [ConfigsService],
  exports: [MongooseModule, ConfigsService],
})
export class ConfigsModule {}
