import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Expense, ExpenseSchema } from './schemas/expense.schema';
import { WeeklyNote, WeeklyNoteSchema } from './schemas/weekly-note.schema';
import { WeeklyBalance, WeeklyBalanceSchema } from './schemas/weekly-balance.schema';
import { Purchase, PurchaseSchema } from '../inventory/schemas/purchase.schema';
import { InventoryModule } from '../inventory/inventory.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { PayrollModule } from '../payroll/payroll.module';
import { ExpensesService } from './expenses.service';
import { ExpensesReportService } from './expenses-report.service';
import { InformePdfService } from './informe-pdf.service';
import { ExpensesController } from './expenses.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Expense.name, schema: ExpenseSchema },
      { name: WeeklyNote.name, schema: WeeklyNoteSchema },
      { name: WeeklyBalance.name, schema: WeeklyBalanceSchema },
      { name: Purchase.name, schema: PurchaseSchema },
    ]),
    InventoryModule,
    AnalyticsModule,
    // La nomina no pasa por el libro de egresos y hay que restarla aparte.
    PayrollModule,
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService, ExpensesReportService, InformePdfService],
  exports: [ExpensesService, ExpensesReportService, InformePdfService],
})
export class ExpensesModule {}
