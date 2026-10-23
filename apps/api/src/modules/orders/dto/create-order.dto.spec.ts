import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { CreateOrderDto, OrderItemDto } from './create-order.dto';

/**
 * Lo que el DTO deja pasar y lo que descarta EN SILENCIO.
 *
 * El `ValidationPipe` global corre con `whitelist: true` (`main.ts:37-40`).
 * Eso significa que **un campo que no esté declarado en el DTO no da 400: se
 * borra y nadie se entera**. Ese mecanismo, que normalmente protege, es la
 * causa exacta de los dos bugs que estas pruebas fijan:
 *
 * 1. `inventoryConsumedQty` no estaba declarado. La conversión a tobo lo manda
 *    para avisar "estas 12 unidades YA se descontaron al entregarse", el
 *    whitelist lo borraba, el servidor veía una entrega nueva y volvía a
 *    reservar las 12. **Doble descuento de inventario, sin un solo error.**
 *
 * 2. `removedIngredients` se declaraba como `@IsArray()` a secas, sin validar
 *    el contenido. Entraban objetos, números y cadenas vacías; y una cadena
 *    vacía hacía que el motor de consumo anulara el descuento COMPLETO del
 *    ítem, porque comparaba por substring y `"algo".includes("")` es true.
 *
 * Se prueba contra el pipe REAL con la misma configuración de producción, no
 * contra una imitación: el bug vivía justamente en el pipe.
 */
describe('CreateOrderDto contra el ValidationPipe real', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const meta = {
    type: 'body' as const,
    metatype: CreateOrderDto,
    data: '',
  };

  const ordenCon = (item: Record<string, unknown>) => ({
    userId: 'u1',
    items: [item],
    subtotal: 11,
    total: 11,
  });

  const lineaDeTobo = (extra: Record<string, unknown> = {}) => ({
    productId: 'pack-tobo-12',
    name: 'Tobo de Cerveza (12 und)',
    quantity: 12,
    unitPrice: 0.92,
    total: 11,
    ...extra,
  });

  describe('conversión a pack: el aviso de "ya se descontó" tiene que llegar', () => {
    it('inventoryConsumedQty sobrevive al whitelist', async () => {
      const salida = (await pipe.transform(
        ordenCon(lineaDeTobo({ inventoryConsumedQty: 12 })),
        meta,
      )) as CreateOrderDto;

      expect(salida.items[0].inventoryConsumedQty).toBe(12);
    });

    it('presentationQty sobrevive al whitelist', async () => {
      const salida = (await pipe.transform(
        ordenCon(lineaDeTobo({ presentationQty: 12 })),
        meta,
      )) as CreateOrderDto;

      expect(salida.items[0].presentationQty).toBe(12);
    });

    it('un campo que de verdad no existe SÍ se descarta (el whitelist sigue vivo)', async () => {
      const salida = (await pipe.transform(
        ordenCon(lineaDeTobo({ campoInventado: 'x' })),
        meta,
      )) as CreateOrderDto;

      expect(
        (salida.items[0] as unknown as Record<string, unknown>).campoInventado,
      ).toBeUndefined();
    });
  });

  describe('modificadores: el contenido de removedIngredients', () => {
    const conIngredientes = (removedIngredients: unknown) =>
      pipe.transform(
        ordenCon(lineaDeTobo({ customizations: { removedIngredients } })),
        meta,
      );

    it('acepta una lista de IDs', async () => {
      const salida = (await conIngredientes([
        'CEB',
        'MOZZA',
      ])) as CreateOrderDto;

      expect(salida.items[0].customizations?.removedIngredients).toEqual([
        'CEB',
        'MOZZA',
      ]);
    });

    it('rechaza objetos y números en vez de tragárselos', async () => {
      await expect(conIngredientes([{}, 123, null])).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rechaza una cadena vacía — anulaba el descuento entero del ítem', async () => {
      await expect(conIngredientes([''])).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rechaza una cadena de solo espacios', async () => {
      await expect(conIngredientes(['   '])).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rechaza que no sea un arreglo — reventaba el consumo de la orden entera', async () => {
      await expect(conIngredientes('cebolla')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('el DTO del ítem se puede instanciar suelto', () => {
    it('declara los campos de inventario que usa la conversión', () => {
      const item = new OrderItemDto();
      item.inventoryConsumedQty = 12;
      item.presentationQty = 12;

      expect(item.inventoryConsumedQty).toBe(12);
      expect(item.presentationQty).toBe(12);
    });
  });

  describe('estados del pedido: un valor inválido es 400, no 500', () => {
    const base = { userId: 'u1', items: [], subtotal: 0, total: 0 };

    it('paymentStatus en mayúscula (PENDING) se rechaza con 400', async () => {
      await expect(
        pipe.transform({ ...base, paymentStatus: 'PENDING' }, meta),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('status en minúscula (pending) se rechaza con 400', async () => {
      await expect(
        pipe.transform({ ...base, status: 'pending' }, meta),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('los valores correctos pasan, y null explícito también', async () => {
      const salida = (await pipe.transform(
        { ...base, status: 'PENDING', paymentStatus: 'pending' },
        meta,
      )) as CreateOrderDto;
      expect(salida.status).toBe('PENDING');
      await expect(
        pipe.transform({ ...base, status: null, paymentStatus: null }, meta),
      ).resolves.toBeDefined();
    });
  });
});
