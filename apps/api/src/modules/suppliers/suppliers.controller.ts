import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@odin6/types';

@ApiTags('suppliers')
@Controller('api/suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @ApiOperation({ summary: 'List all suppliers with optional filters' })
  @ApiResponse({ status: 200, description: 'List of suppliers' })
  findAll(
    @Query('active') active?: string,
    @Query('productId') productId?: string,
  ) {
    const filters = {
      active: active === 'true',
      productId,
    };
    return this.suppliersService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get supplier by ID' })
  @ApiResponse({ status: 200, description: 'Supplier found' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  findById(@Param('id') id: string) {
    return this.suppliersService.findById(id);
  }

  @Post()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Create a new supplier' })
  @ApiResponse({ status: 201, description: 'Supplier created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  create(@Body() createSupplierDto: CreateSupplierDto) {
    return this.suppliersService.create(createSupplierDto);
  }

  @Patch(':id')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Update a supplier' })
  @ApiResponse({ status: 200, description: 'Supplier updated' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  update(
    @Param('id') id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(id, updateSupplierDto);
  }

  @Delete(':id')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Soft delete a supplier' })
  @ApiResponse({ status: 200, description: 'Supplier deleted' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  remove(@Param('id') id: string) {
    return this.suppliersService.softDelete(id);
  }

  @Post(':supplierId/products/:productId')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Add product to supplier' })
  @ApiResponse({ status: 200, description: 'Product added to supplier' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  addProductToSupplier(
    @Param('supplierId') supplierId: string,
    @Param('productId') productId: string,
  ) {
    return this.suppliersService.addProductToSupplier(supplierId, productId);
  }

  @Delete(':supplierId/products/:productId')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Remove product from supplier' })
  @ApiResponse({ status: 200, description: 'Product removed from supplier' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  removeProductFromSupplier(
    @Param('supplierId') supplierId: string,
    @Param('productId') productId: string,
  ) {
    return this.suppliersService.removeProductFromSupplier(
      supplierId,
      productId,
    );
  }
}
