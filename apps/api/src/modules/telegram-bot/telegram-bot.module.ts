import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { ExpensesModule } from '../expenses/expenses.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { ExchangeModule } from '../exchange/exchange.module';
import { OcrModule } from '../ocr/ocr.module';
import { UploadsModule } from '../uploads/uploads.module';
import { EmployeesModule } from '../employees/employees.module';
import { TelegramConfigService } from './telegram-config.service';
import { ComprasConfigService } from './compras-config.service';
import { SessionStore } from './session.store';
import { BotDepsService } from './bot-deps.service';
import { PhotoHandler } from './photo.handler';
import { CommandsHandler } from './commands.handler';
import { GroupNotifierService } from './group-notifier.service';
import { SchedulerService } from './scheduler.service';
import { TelegramBotService } from './telegram-bot.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
    ExpensesModule,
    InventoryModule,
    SuppliersModule,
    ExchangeModule,
    OcrModule,
    UploadsModule,
    EmployeesModule,
  ],
  providers: [
    TelegramConfigService,
    ComprasConfigService,
    SessionStore,
    BotDepsService,
    PhotoHandler,
    CommandsHandler,
    GroupNotifierService,
    SchedulerService,
    TelegramBotService,
  ],
})
export class TelegramBotModule {}
