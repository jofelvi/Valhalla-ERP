import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ClientVersionInterceptor } from './common/interceptors/client-version.interceptor';
import { EnvValidatorService } from './common/validators/env-validator.service';
import { User, UserSchema } from './modules/auth/schemas/user.schema';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { TablesModule } from './modules/tables/tables.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ProductsModule } from './modules/products/products.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { PurchaseOrdersModule } from './modules/purchase-orders/purchase-orders.module';
import { AlmacenModule } from './modules/almacen/almacen.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PagoMovilModule } from './modules/pago-movil/pago-movil.module';
import { EventReservationsModule } from './modules/event-reservations/event-reservations.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { TipsModule } from './modules/tips/tips.module';
import { ExchangeModule } from './modules/exchange/exchange.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PrintQueueModule } from './modules/print-queue/print-queue.module';
import { SociosExcluidosModule } from './modules/socios-excluidos/socios-excluidos.module';
import { PrintLogsModule } from './modules/print-logs/print-logs.module';
import { ClientLogsModule } from './modules/client-logs/client-logs.module';
import { AccountDeletionModule } from './modules/account-deletion/account-deletion.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { WebsocketsModule } from './modules/websockets/websockets.module';
import { PublicModule } from './modules/public/public.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { AccountsReceivableModule } from './modules/accounts-receivable/accounts-receivable.module';
import { EmployeeLoansModule } from './modules/employee-loans/employee-loans.module';
import { PaymentReportsModule } from './modules/payment-reports/payment-reports.module';
import { ComisionesModule } from './modules/comisiones/comisiones.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { ReleasesModule } from './modules/releases/releases.module';
import { CashRegisterModule } from './modules/cash-register/cash-register.module';
import { ChatModule } from './modules/chat/chat.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { WhatsappLogsModule } from './modules/whatsapp-logs/whatsapp-logs.module';
import { OcrModule } from './modules/ocr/ocr.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { TelegramBotModule } from './modules/telegram-bot/telegram-bot.module';
import { ConfigsModule } from './modules/configs/configs.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    // Configuracion global desde .env
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // MongoDB connection
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri:
          configService.get<string>('MONGODB_URI') ||
          'mongodb://127.0.0.1:27017/pos',
      }),
      inject: [ConfigService],
    }),

    // Feature modules
    AuthModule,
    UsersModule,
    CategoriesModule,
    TablesModule,
    CustomersModule,
    ProductsModule,
    AlertsModule,
    SuppliersModule,
    PurchaseOrdersModule,
    AlmacenModule,
    InventoryModule,
    ExpensesModule,
    TelegramBotModule,
    OrdersModule,
    PaymentsModule,
    PagoMovilModule,
    EventReservationsModule,
    InvoicesModule,
    TipsModule,
    ExchangeModule,
    NotificationsModule,
    PrintQueueModule,
    SociosExcluidosModule,
    PrintLogsModule,
    ClientLogsModule,
    AccountDeletionModule,
    AnalyticsModule,
    WebsocketsModule,
    PublicModule,
    EmployeesModule,
    AttendanceModule,
    PayrollModule,
    AccountsReceivableModule,
    EmployeeLoansModule,
    PaymentReportsModule,
    ComisionesModule,
    BudgetsModule,
    ReleasesModule,
    CashRegisterModule,
    ChatModule,
    UploadsModule,
    WhatsappLogsModule,
    OcrModule,
    ConfigsModule,
    // El interceptor de version necesita el modelo de usuarios.
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [HealthController],
  providers: [
    // Guarda la version del APK que usa cada persona (el header ya llega en
    // cada request; antes se tiraba). Va como interceptor porque necesita el
    // usuario del guard de JWT.
    { provide: APP_INTERCEPTOR, useClass: ClientVersionInterceptor },
    // Valida que las variables de entorno criticas esten configuradas al arrancar.
    EnvValidatorService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
