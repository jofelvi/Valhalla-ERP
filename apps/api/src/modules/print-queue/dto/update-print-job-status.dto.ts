import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PrintJobStatus } from '../schemas/print-job.schema';

export class UpdatePrintJobStatusDto {
  @IsEnum(PrintJobStatus)
  status: PrintJobStatus;

  @IsOptional()
  @IsString()
  errorMessage?: string;
}
