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

  // El cliente ve y edita SU PROPIA ficha (mismo _id que su `users`, ver
  // AuthService.ensureCustomerRecord). El staff ve cualquiera. La regla fina
  // (dueno o staff) se valida en assertSelfOrStaff.
  @Get(':id')
  @Roles(...STAFF_ROLES, UserRoleEnum.CUSTOMER)
  @ApiOperation({ summary: 'Get customer by ID (propio perfil o staff)' })
  @ApiResponse({ status: 200, description: 'Customer retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async findById(@Param('id') id: string, @Request() req: AuthedRequest) {
    this.assertSelfOrStaff(id, req);
    return this.customersService.findById(id);
  }

  /**
   * Sin usuario resuelto se rechaza: no depende del interruptor de lecturas
   * (AUTH_ENFORCE_READS), porque aqui se expone la ficha de una persona. Con
   * usuario, solo pasa el dueno de la ficha o alguien de staff.
   */
  private assertSelfOrStaff(id: string, req: AuthedRequest): void {
    const user = req.user;
    if (!user) throw new ForbiddenException('Sesion requerida');
    if (user.id === id) return;
    if (STAFF_ROLES.includes(user.role as UserRoleEnum)) return;
    throw new ForbiddenException('No autorizado para ver este cliente');
  }

  // Alta de fichas: solo staff (CustomerSelectModal al crear un cliente). El
  // registro del cliente no pasa por aqui: la ficha se crea en el servidor.
  @Post()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Create new customer (staff)' })
  @ApiResponse({ status: 201, description: 'Customer created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  // Edicion: staff edita cualquier ficha; el cliente solo la suya (el
  // registro en la app actualiza su propia ficha, RegisterStep1-5 y perfil).
  @Patch(':id')
  @Roles(...STAFF_ROLES, UserRoleEnum.CUSTOMER)
  @ApiOperation({ summary: 'Update customer (propia ficha o staff)' })
  @ApiResponse({ status: 200, description: 'Customer updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
    @Request() req: AuthedRequest,
  ) {
    this.assertSelfOrStaff(id, req);
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
