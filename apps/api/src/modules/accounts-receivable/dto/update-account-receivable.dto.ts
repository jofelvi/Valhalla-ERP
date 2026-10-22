import { PartialType } from '@nestjs/swagger';
import { CreateAccountReceivableDto } from './create-account-receivable.dto';

export class UpdateAccountReceivableDto extends PartialType(
  CreateAccountReceivableDto,
) {}
