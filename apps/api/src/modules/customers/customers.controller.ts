import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  Query,
  Request,
  UseGuards,
  HttpCode,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@odin6/types';

interface AuthedRequest {
  user?: { id: string; email?: string; role?: string };
}

// Roles de staff que pueden buscar/consultar clientes ajenos (cajero cobrando,
// mesonero enlazando una mesa/orden a un cliente via CustomerSelectModal,
// etc). Un CUSTOMER autenticado NUNCA cae en esta lista.
const STAFF_ROLES = [
  UserRoleEnum.ADMIN,
  UserRoleEnum.MANAGER,
  UserRoleEnum.CASHIER,
  UserRoleEnum.WAITER,
];

@ApiTags('customers')
@Controller('api/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  // Listado completo (2.943+ fichas con nombre/telefono/credito): antes
  // cualquier cuenta autenticada -incluido un CUSTOMER- lo podia pedir.
  @Get()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.CASHIER)
  @ApiOperation({ summary: 'List all customers (staff)' })
  @ApiResponse({ status: 200, description: 'Customers retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiQuery({
    name: 'vista',
    required: false,
    description:
      "'lista' recorta a los campos que pintan los listados. Sin el parametro se manda la ficha completa.",
  })
  @ApiQuery({
    name: 'activos',
    required: false,
    description: "'true' deja fuera las fichas dadas de baja.",
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Techo: 15000' })
  @ApiQuery({ name: 'page', required: false })
  async findAll(
    @Query('vista') vista?: string,
    @Query('activos') activos?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.customersService.findAll({ vista, activos, limit, page });
  }

  // Mismo riesgo que el listado: buscar por nombre/email/telefono permite
  // enumerar clientes ajenos. Solo lo usa el staff (CustomerSelectModal en
  // el movil, al crear/editar una orden).
  @Get('search')
  @Roles(...STAFF_ROLES)
  @ApiOperation({
    summary: 'Search customers by name, email, or phone (staff)',
  })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiResponse({ status: 200, description: 'Customers found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async search(@Query('q') q: string) {
    return this.customersService.search(q);
  }

  @Get('by-member/:action')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Find customers by member action (staff)' })
  @ApiResponse({ status: 200, description: 'Customers found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findByMemberAction(@Param('action') action: string) {
    return this.customersService.findByMemberAction(action);
  }

  // Sin @Roles a proposito: el cliente ve SU PROPIA ficha (mismo _id que su
  // `users`, ver AuthService.ensureCustomerRecord) desde la app movil. Se
  // valida a mano que sea su propio id o que sea staff, en vez de bloquear
  // todo el endpoint como en el resto del controller.
  @Get(':id')
  @ApiOperation({ summary: 'Get customer by ID (propio perfil o staff)' })
  @ApiResponse({ status: 200, description: 'Customer retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async findById(@Param('id') id: string, @Request() req: AuthedRequest) {
    this.assertSelfOrStaff(id, req);
    return this.customersService.findById(id);
  }

  /**
   * Igual que RolesGuard: durante la transicion, sin usuario resuelto se
   * deja pasar (auditoria, no bloqueo — ver JwtAuthGuard). Con usuario, solo
   * pasa el dueno de la ficha o alguien de staff.
   */
  private assertSelfOrStaff(id: string, req: AuthedRequest): void {
    const user = req.user;
    if (!user) return;
    if (user.id === id) return;
    if (STAFF_ROLES.includes(user.role as UserRoleEnum)) return;
    throw new ForbiddenException('No autorizado para ver este cliente');
  }

  @Post()
  @ApiOperation({ summary: 'Create new customer' })
  @ApiResponse({ status: 201, description: 'Customer created successfully' })
  async create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update customer' })
  @ApiResponse({ status: 200, description: 'Customer updated successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, updateCustomerDto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Soft delete customer (ADMIN, MANAGER)' })
  @ApiResponse({ status: 204, description: 'Customer deleted successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async softDelete(@Param('id') id: string) {
    await this.customersService.softDelete(id);
  }
}
