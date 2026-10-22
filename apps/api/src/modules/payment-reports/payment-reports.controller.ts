import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  UseGuards,
  Body,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PaymentReportsService } from './payment-reports.service';
import { CreatePaymentReportDto } from './dto/create-payment-report.dto';
import {
  ApprovePaymentReportDto,
  RejectPaymentReportDto,
} from './dto/review-payment-report.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@odin6/types';

@ApiTags('payment-reports')
@Controller('api/payment-reports')
export class PaymentReportsController {
  constructor(private readonly paymentReportsService: PaymentReportsService) {}

  @Post('public')
  @ApiOperation({
    summary: 'Create payment report (PUBLIC - NO AUTH REQUIRED)',
  })
  @ApiResponse({ status: 201, description: 'Report created successfully' })
  async createPublic(@Body() createPaymentReportDto: CreatePaymentReportDto) {
    return this.paymentReportsService.create(createPaymentReportDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List payment reports' })
  @ApiResponse({ status: 200, description: 'Reports retrieved successfully' })
  async findAll(@Query('status') status?: string) {
    return this.paymentReportsService.findAll({ status });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment report by ID' })
  @ApiResponse({ status: 200, description: 'Report retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async findById(@Param('id') id: string) {
    return this.paymentReportsService.findById(id);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve payment report (ADMIN, MANAGER)' })
  @ApiResponse({ status: 200, description: 'Report approved successfully' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async approve(
    @Param('id') id: string,
    @Body() approvePaymentReportDto: ApprovePaymentReportDto,
  ) {
    return this.paymentReportsService.approve(id, approvePaymentReportDto);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject payment report (ADMIN, MANAGER)' })
  @ApiResponse({ status: 200, description: 'Report rejected successfully' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async reject(
    @Param('id') id: string,
    @Body() rejectPaymentReportDto: RejectPaymentReportDto,
  ) {
    return this.paymentReportsService.reject(id, rejectPaymentReportDto);
  }
}
