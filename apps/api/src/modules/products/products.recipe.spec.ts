import { OPERACION_DEFAULT } from '@odin6/types';
import { ConfigsService } from '../configs/configs.service';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from './schemas/product.schema';
import { Employee } from '../employees/schemas/employee.schema';

/**
 * Reglas de la edicion de receta desde el telefono.
 *
 * Se prueba el SERVICIO y no el controlador porque la autorizacion real vive
 * aqui: los guards de Nest en este proyecto son permisivos y la leccion de la
 * sesion del candado fue no confiar en ellos para decidir quien toca que.
 */

type Doc = Record<string, unknown>;

const conLean = <T>(valor: T) => ({
  lean: () => ({ exec: () => Promise.resolve(valor) }),
  select: () => ({ lean: () => ({ exec: () => Promise.resolve(valor) }) }),
});

describe('ProductsService.updateRecipe', () => {
  const pizza: Doc = {
    _id: 'pizza-1',
    name: 'Pizza Grande',
    station: 'PIZZA',
    type: 'BASE',
  };
  const perroCaliente: Doc = {
    _id: 'perro-1',
    name: 'Perro Caliente',
    station: 'KITCHEN',
    type: 'BASE',
  };
  const queso: Doc = {
    _id: 'queso',
    name: 'Mozzarella',
    cost: 6,
    presentation: 'Kg',
    presentationQuantity: 1,
  };
  const masa: Doc = {
    _id: 'masa',
    name: 'Masa mediana',
    cost: 0.4,
    presentation: 'Unidad',
    presentationQuantity: 1,
    ingredients: [{ productId: 'harina', quantity: 250, unit: 'gr' }],
  };
  const pizzero: Doc = {
    _id: 'emp-pizzero',
    firstName: 'DANIEL',
    lastName: 'VARGAS',
    salary: 250, // mensual, igual que en `employees`
  };

  let service: ProductsService;
  let guardado: Doc | null;

  const productModel = {
    findOne: jest.fn((q: { _id: string }) =>
      conLean(
        [pizza, perroCaliente, queso, masa].find((p) => p._id === q._id) ??
          null,
      ),
    ),
    find: jest.fn((q: { _id: { $in: string[] } }) =>
      conLean(
        [pizza, perroCaliente, queso, masa].filter((p) =>
          q._id.$in.includes(String(p._id)),
        ),
      ),
    ),
    findOneAndUpdate: jest.fn((_q: Doc, upd: { $set: Doc }) => {
      guardado = upd.$set;
      return conLean({ _id: 'pizza-1', ...upd.$set });
    }),
  };
  const employeeModel = {
    findOne: jest.fn((q: { _id: string }) =>
      conLean(q._id === 'emp-pizzero' ? pizzero : null),
    ),
  };

  beforeEach(async () => {
    guardado = null;
    const mod = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getModelToken(Product.name), useValue: productModel },
        { provide: getModelToken(Employee.name), useValue: employeeModel },
        {
          provide: ConfigsService,
          useValue: { obtener: () => Promise.resolve(OPERACION_DEFAULT) },
        },
      ],
    }).compile();
    service = mod.get(ProductsService);
  });

  const receta = [{ productId: 'queso', quantity: 200, unit: 'gr' }];

  it('el pizzero puede cargar la receta de una pizza y el producto pasa a PREPARADO', async () => {
    await service.updateRecipe(
      'pizza-1',
      { ingredients: receta },
      { role: 'pizza', email: 'daniel.pizza@ejemplo.com' },
    );
    // Antes se escribia el literal 'MIXED', que NO es un valor de
    // ProductTypeEnum (es 'COMPUESTO'). Mongoose no valida enums en los
    // updates, asi que el dato quedaba corrupto en silencio y la ficha no
    // reconocia el producto como preparado.
    expect(guardado!.type).toBe('COMPUESTO');
    expect(guardado!.recipeUpdatedBy).toBe('daniel.pizza@ejemplo.com');
    // 200 gr de un queso de $6/Kg = $1,20 de materia prima
    expect(guardado!.cost).toBeCloseTo(1.2, 4);
  });

  // Regla del dueño: cada estacion SOLO su mundo. Si barra pudiera tocar la
  // receta de cocina, podria bajarle los gramos a un plato que no prepara y
  // el faltante le caeria a otro.
  it('el pizzero NO puede tocar un plato de cocina', async () => {
    await expect(
      service.updateRecipe(
        'perro-1',
        { ingredients: receta },
        { role: 'pizza', email: 'daniel.pizza@ejemplo.com' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza un ingrediente que no existe', async () => {
    await expect(
      service.updateRecipe(
        'pizza-1',
        { ingredients: [{ productId: 'fantasma', quantity: 1, unit: 'und' }] },
        { role: 'admin' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('un producto no puede ser ingrediente de si mismo', async () => {
    await expect(
      service.updateRecipe(
        'pizza-1',
        { ingredients: [{ productId: 'pizza-1', quantity: 1, unit: 'und' }] },
        { role: 'admin' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // Lo nuevo: el tiempo. 12 minutos del pizzero ($250/mes) son $0,2232 —
  // el plato deja de costar solo lo que pesa.
  it('guarda el tiempo de preparacion y le pone precio con el sueldo real', async () => {
    await service.updateRecipe(
      'pizza-1',
      {
        ingredients: receta,
        prepTimeMinutes: 12,
        preparedByEmployeeId: 'emp-pizzero',
      },
      { role: 'pizza', email: 'daniel.pizza@ejemplo.com' },
    );
    expect(guardado!.prepTimeMinutes).toBe(12);
    expect(guardado!.preparedByName).toBe('DANIEL VARGAS');
    expect(guardado!.laborCost).toBeCloseTo(0.2232, 4);
    // El costo de materia prima NO se contamina con el sueldo: es lo que
    // valora el inventario y debe seguir cuadrando con la nevera.
    expect(guardado!.cost).toBeCloseTo(1.2, 4);
  });

  // La expansion de receta es de UN nivel: un semielaborado como ingrediente
  // se descuenta a si mismo, no a su harina. Es valido, pero hay que producirlo.
  it('avisa cuando un ingrediente es a su vez un producto con receta', async () => {
    const r = await service.updateRecipe(
      'pizza-1',
      { ingredients: [{ productId: 'masa', quantity: 1, unit: 'und' }] },
      { role: 'admin' },
    );
    expect(r.avisos[0]).toContain('producto compuesto');
  });

  it('rechaza un preparador inexistente', async () => {
    await expect(
      service.updateRecipe(
        'pizza-1',
        {
          ingredients: receta,
          prepTimeMinutes: 10,
          preparedByEmployeeId: 'nadie',
        },
        { role: 'admin' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sin encargado guarda el tiempo igual, con mano de obra en cero', async () => {
    await service.updateRecipe(
      'pizza-1',
      { ingredients: receta, prepTimeMinutes: 12 },
      { role: 'admin' },
    );
    expect(guardado!.prepTimeMinutes).toBe(12);
    expect(guardado!.laborCost).toBeUndefined();
  });
});
