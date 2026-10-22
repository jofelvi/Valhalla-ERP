import { Test } from '@nestjs/testing';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import { CatalogAuditService } from './catalog-audit.service';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';

describe('CatalogAuditService', () => {
  let mongod: MongoMemoryServer;
  let service: CatalogAuditService;
  let connection: Connection;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: Order.name, schema: OrderSchema },
          { name: Product.name, schema: ProductSchema },
        ]),
      ],
      providers: [CatalogAuditService],
    }).compile();
    service = module.get(CatalogAuditService);
    connection = module.get(getConnectionToken());
  });

  afterAll(async () => {
    await connection.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    try {
      await connection.collection('products').drop();
    } catch {
      // Coleccion no existe, ignorar
    }
    try {
      await connection.collection('orders').drop();
    } catch {
      // Coleccion no existe, ignorar
    }
  });

  describe('Cobertura exacta', () => {
    it('debe calcular cobertura: 60% si 6 de 10 unidades son de productos con receta o insumo directo', async () => {
      // Crear productos
      await connection.collection('products').insertMany([
        {
          _id: 'pizza',
          name: 'Pizza Margarita',
          price: 12,
          isForInventory: false,
          ingredients: [
            {
              productId: 'harina',
              quantity: 500,
              unit: 'gr',
              wastePercentage: 5,
            },
          ],
          type: 'PRODUCTO',
        },
        {
          _id: 'hamburguesa',
          name: 'Hamburguesa',
          price: 10,
          isForInventory: true,
          type: 'PRODUCTO',
        },
        {
          _id: 'bebida',
          name: 'Bebida sin receta',
          price: 2,
          isForInventory: false,
          type: 'PRODUCTO',
        },
        {
          _id: 'harina',
          name: 'Harina',
          cost: 50,
          isForInventory: true,
          presentation: 'Kilogramo',
          presentationQuantity: 1,
          type: 'BASE',
        },
      ]);

      // Crear orden pagada con 10 unidades (6 con tracking, 4 sin)
      const now = new Date();
      await connection.collection('orders').insertOne({
        _id: 'order1',
        userId: 'user1',
        status: 'DELIVERED',
        paymentStatus: 'paid',
        items: [
          {
            productId: 'pizza',
            quantity: 3,
            name: 'Pizza',
            total: 36,
            unitPrice: 12,
          },
          {
            productId: 'hamburguesa',
            quantity: 3,
            name: 'Hamburguesa',
            total: 30,
            unitPrice: 10,
          },
          {
            productId: 'bebida',
            quantity: 4,
            name: 'Bebida',
            total: 8,
            unitPrice: 2,
          },
        ],
        subtotal: 74,
        tax: 0,
        total: 74,
        createdAt: now,
      });

      const audit = await service.getAudit(30);

      // 6 unidades con tracking (pizza + hamburguesa) ÷ 10 total × 100 = 60%
      expect(audit.coveragePct).toBe(60);
    });
  });

  describe('Receta con unidad incompatible', () => {
    it('debe detectar cuando un ingrediente tiene unidad incompatible con la base del insumo', async () => {
      // Crear insumo con base GR
      await connection.collection('products').insertMany([
        {
          _id: 'harina',
          name: 'Harina',
          price: 0,
          categoryId: 'cat1',
          cost: 50,
          presentation: 'Kilogramo',
          presentationQuantity: 1,
          isForInventory: true,
          type: 'BASE',
        },
        {
          _id: 'pizza',
          name: 'Pizza con harina en ML (incompatible)',
          price: 12,
          categoryId: 'cat1',
          ingredients: [
            {
              productId: 'harina',
              quantity: 500,
              unit: 'ml', // ML es base ML, pero harina es base GR → incompatible
              wastePercentage: 5,
            },
          ],
          type: 'PRODUCTO',
        },
      ]);

      // Crear orden vendiendo la pizza
      const now = new Date();
      await connection.collection('orders').insertOne({
        _id: 'order1',
        userId: 'user1',
        status: 'DELIVERED',
        paymentStatus: 'paid',
        items: [
          {
            productId: 'pizza',
            quantity: 1,
            name: 'Pizza',
            total: 12,
            unitPrice: 12,
          },
        ],
        subtotal: 12,
        tax: 0,
        total: 12,
        createdAt: now,
      });

      const audit = await service.getAudit(30);

      expect(audit.recipesWithIssues).toHaveLength(1);
      expect(audit.recipesWithIssues[0].productId).toBe('pizza');
      // El mensaje dice CÓMO se compra el insumo y en qué lo pide la receta:
      // "incompatible con base GR" no le decía a cocina qué corregir.
      expect(audit.recipesWithIssues[0].issues[0]).toContain(
        'se compra por Kilogramo',
      );
      expect(audit.recipesWithIssues[0].issues[0]).toContain('nunca descuenta');
    });
  });

  describe('Insumo sin barcode listado', () => {
    it('debe listar insumo sin barcode en insumosIncomplete', async () => {
      // Crear insumo sin barcode pero con todo lo demás
      await connection.collection('products').insertMany([
        {
          _id: 'harina',
          name: 'Harina',
          cost: 50,
          presentation: 'Kilogramo',
          presentationQuantity: 1,
          isForInventory: true,
          type: 'BASE',
          // NO tiene barcode
          imageUrl: 'http://example.com/harina.jpg',
        },
      ]);

      const audit = await service.getAudit(30);

      expect(audit.insumosIncomplete).toHaveLength(1);
      expect(audit.insumosIncomplete[0].productId).toBe('harina');
      expect(audit.insumosIncomplete[0].missing).toContain('barcode');
    });

    it('debe listar insumo con múltiples campos faltantes', async () => {
      await connection.collection('products').insertMany([
        {
          _id: 'aceite',
          name: 'Aceite',
          // SIN cost
          // SIN imageUrl
          // SIN barcode
          presentation: 'Litro',
          presentationQuantity: 1,
          isForInventory: true,
          type: 'BASE',
        },
      ]);

      const audit = await service.getAudit(30);

      expect(audit.insumosIncomplete).toHaveLength(1);
      const incomplete = audit.insumosIncomplete[0];
      expect(incomplete.missing).toContain('barcode');
      expect(incomplete.missing).toContain('foto');
      expect(incomplete.missing).toContain('costo');
    });

    it('debe listar insumo sin contenido (presentationQuantity)', async () => {
      await connection.collection('products').insertMany([
        {
          _id: 'sal',
          name: 'Sal',
          cost: 5,
          barcode: '1234567890',
          imageUrl: 'http://example.com/sal.jpg',
          // SIN presentationQuantity
          presentation: 'Kilogramo',
          isForInventory: true,
          type: 'BASE',
        },
      ]);

      const audit = await service.getAudit(30);

      expect(audit.insumosIncomplete).toHaveLength(1);
      expect(audit.insumosIncomplete[0].missing).toContain('contenido');
    });
  });

  describe('Servicio legacy listado', () => {
    it('debe listar servicios BASE con isForInventory: false explícito', async () => {
      await connection.collection('products').insertMany([
        {
          _id: 'animador',
          name: 'Servicio Animador',
          type: 'BASE',
          isForInventory: false, // Explícito
          price: 100,
        },
        {
          _id: 'sonido',
          name: 'Sonido',
          type: 'BASE',
          isForInventory: false, // Explícito
          price: 50,
        },
        {
          _id: 'insumo_activo',
          name: 'Insumo que sí es for inventory',
          type: 'BASE',
          isForInventory: true, // No es legacy
          cost: 20,
          presentation: 'Kg',
          presentationQuantity: 1,
        },
      ]);

      const audit = await service.getAudit(30);

      expect(audit.legacyBaseServices).toHaveLength(2);
      expect(audit.legacyBaseServices).toContainEqual({
        productId: 'animador',
        name: 'Servicio Animador',
      });
      expect(audit.legacyBaseServices).toContainEqual({
        productId: 'sonido',
        name: 'Sonido',
      });
    });
  });

  describe('Productos sin receta', () => {
    it('debe listar productos vendidos sin receta ni isForInventory, top 50 ordenados por unidades', async () => {
      await connection.collection('products').insertMany([
        {
          _id: 'refr1',
          name: 'Refresco A',
          price: 2,
          categoryId: 'cat1',
          // SIN ingredients, SIN isForInventory
          type: 'PRODUCTO',
        },
        {
          _id: 'refr2',
          name: 'Refresco B',
          price: 2,
          categoryId: 'cat1',
          type: 'PRODUCTO',
        },
        {
          _id: 'con_receta',
          name: 'Con Receta',
          price: 12,
          categoryId: 'cat1',
          ingredients: [
            {
              productId: 'agua',
              quantity: 200,
              unit: 'ml',
              wastePercentage: 0,
            },
          ],
          type: 'PRODUCTO',
        },
      ]);

      // Crear órdenes pagadas vendiendo estos productos
      const now = new Date();
      await connection.collection('orders').insertMany([
        {
          _id: 'order1',
          userId: 'user1',
          status: 'DELIVERED',
          paymentStatus: 'paid',
          items: [
            {
              productId: 'refr1',
              quantity: 10,
              name: 'Refresco A',
              total: 20,
              unitPrice: 2,
            },
            {
              productId: 'refr2',
              quantity: 5,
              name: 'Refresco B',
              total: 10,
              unitPrice: 2,
            },
            {
              productId: 'con_receta',
              quantity: 1,
              name: 'Con Receta',
              total: 12,
              unitPrice: 12,
            },
          ],
          subtotal: 42,
          tax: 0,
          total: 42,
          createdAt: now,
        },
      ]);

      const audit = await service.getAudit(30);

      expect(audit.soldWithoutRecipe).toHaveLength(2);
      // Ordenado desc por unidades: refr1 (10) primero
      expect(audit.soldWithoutRecipe[0]).toEqual({
        productId: 'refr1',
        name: 'Refresco A',
        unitsSold: 10,
        revenue: 20,
      });
      expect(audit.soldWithoutRecipe[1]).toEqual({
        productId: 'refr2',
        name: 'Refresco B',
        unitsSold: 5,
        revenue: 10,
      });
    });
  });

  describe('Filtro de días', () => {
    it('debe incluir solo órdenes dentro del rango de días', async () => {
      await connection.collection('products').insertMany([
        {
          _id: 'refr',
          name: 'Refresco',
          price: 2,
          type: 'PRODUCTO',
        },
      ]);

      const now = new Date();
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      await connection.collection('orders').insertMany([
        {
          _id: 'recent',
          userId: 'user1',
          status: 'DELIVERED',
          paymentStatus: 'paid',
          items: [
            {
              productId: 'refr',
              quantity: 5,
              name: 'Refresco',
              total: 10,
              unitPrice: 2,
            },
          ],
          subtotal: 10,
          tax: 0,
          total: 10,
          createdAt: twoWeeksAgo,
        },
        {
          _id: 'old',
          userId: 'user1',
          status: 'DELIVERED',
          paymentStatus: 'paid',
          items: [
            {
              productId: 'refr',
              quantity: 3,
              name: 'Refresco',
              total: 6,
              unitPrice: 2,
            },
          ],
          subtotal: 6,
          tax: 0,
          total: 6,
          createdAt: twoMonthsAgo,
        },
      ]);

      // Con días=30, solo debería incluir 'recent' (2 semanas atrás)
      const audit30 = await service.getAudit(30);
      expect(audit30.soldWithoutRecipe).toHaveLength(1);
      expect(audit30.soldWithoutRecipe[0].unitsSold).toBe(5);

      // Con días=90, debería incluir ambas
      const audit90 = await service.getAudit(90);
      expect(audit90.soldWithoutRecipe).toHaveLength(1);
      expect(audit90.soldWithoutRecipe[0].unitsSold).toBe(8); // 5 + 3
    });
  });

  describe('Receta con insumo inexistente', () => {
    it('debe listar error si el insumo no existe en el catálogo', async () => {
      await connection.collection('products').insertMany([
        {
          _id: 'pizza',
          name: 'Pizza',
          price: 12,
          categoryId: 'cat1',
          ingredients: [
            {
              productId: 'harina_inexistente',
              quantity: 500,
              unit: 'gr',
              wastePercentage: 5,
            },
          ],
          type: 'PRODUCTO',
        },
      ]);

      const now = new Date();
      await connection.collection('orders').insertOne({
        _id: 'order1',
        userId: 'user1',
        status: 'DELIVERED',
        paymentStatus: 'paid',
        items: [
          {
            productId: 'pizza',
            quantity: 1,
            name: 'Pizza',
            total: 12,
            unitPrice: 12,
          },
        ],
        subtotal: 12,
        tax: 0,
        total: 12,
        createdAt: now,
      });

      const audit = await service.getAudit(30);

      expect(audit.recipesWithIssues).toHaveLength(1);
      expect(audit.recipesWithIssues[0].issues[0]).toContain('no existe');
    });
  });

  describe('Receta con insumo sin costo', () => {
    it('debe listar error si el insumo no tiene costo > 0', async () => {
      await connection.collection('products').insertMany([
        {
          _id: 'harina',
          name: 'Harina',
          price: 0,
          categoryId: 'cat1',
          // SIN cost o cost: 0
          presentation: 'Kilogramo',
          presentationQuantity: 1,
          isForInventory: true,
          type: 'BASE',
        },
        {
          _id: 'pizza',
          name: 'Pizza',
          price: 12,
          categoryId: 'cat1',
          ingredients: [
            {
              productId: 'harina',
              quantity: 500,
              unit: 'gr',
              wastePercentage: 5,
            },
          ],
          type: 'PRODUCTO',
        },
      ]);

      const now = new Date();
      await connection.collection('orders').insertOne({
        _id: 'order1',
        userId: 'user1',
        status: 'DELIVERED',
        paymentStatus: 'paid',
        items: [
          {
            productId: 'pizza',
            quantity: 1,
            name: 'Pizza',
            total: 12,
            unitPrice: 12,
          },
        ],
        subtotal: 12,
        tax: 0,
        total: 12,
        createdAt: now,
      });

      const audit = await service.getAudit(30);

      expect(audit.recipesWithIssues).toHaveLength(1);
      expect(audit.recipesWithIssues[0].issues[0]).toContain('sin costo');
    });
  });

  describe('Orden con items cancelados', () => {
    it('debe ignorar items cancelados al calcular cobertura', async () => {
      await connection.collection('products').insertMany([
        {
          _id: 'pizza',
          name: 'Pizza',
          price: 12,
          ingredients: [
            {
              productId: 'harina',
              quantity: 500,
              unit: 'gr',
              wastePercentage: 5,
            },
          ],
          type: 'PRODUCTO',
        },
        {
          _id: 'refr',
          name: 'Refresco',
          price: 2,
          type: 'PRODUCTO',
        },
        {
          _id: 'harina',
          name: 'Harina',
          cost: 50,
          presentation: 'Kilogramo',
          presentationQuantity: 1,
          isForInventory: true,
          type: 'BASE',
        },
      ]);

      const now = new Date();
      await connection.collection('orders').insertOne({
        _id: 'order1',
        userId: 'user1',
        status: 'DELIVERED',
        paymentStatus: 'paid',
        items: [
          {
            productId: 'pizza',
            quantity: 5,
            name: 'Pizza',
            total: 60,
            unitPrice: 12,
          },
          {
            productId: 'refr',
            quantity: 5,
            name: 'Refresco',
            total: 10,
            unitPrice: 2,
            cancelledAt: new Date(),
            deliveredQty: 0,
          },
        ],
        subtotal: 70,
        tax: 0,
        total: 70,
        createdAt: now,
      });

      const audit = await service.getAudit(30);

      // Solo 5 unidades de pizza (con receta), 5 refr cancelados, total 5
      // Cobertura: 5/5 = 100%
      expect(audit.coveragePct).toBe(100);
      expect(audit.soldWithoutRecipe).toHaveLength(0);
    });
  });
});
