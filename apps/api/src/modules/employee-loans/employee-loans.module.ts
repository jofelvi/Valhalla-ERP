import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EmployeeLoansController } from './employee-loans.controller';
import { EmployeeLoansService } from './employee-loans.service';
import {
  EmployeeLoan,
  EmployeeLoanSchema,
} from './schemas/employee-loan.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EmployeeLoan.name, schema: EmployeeLoanSchema },
    ]),
  ],
  controllers: [EmployeeLoansController],
  providers: [EmployeeLoansService],
  exports: [EmployeeLoansService],
})
export class EmployeeLoansModule {}
