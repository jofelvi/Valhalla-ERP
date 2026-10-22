import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PublicService } from './public.service';
import { Member, accionNormalizada } from './schemas/member.schema';

/**
 * CREDITO DE SOCIOS.
 *
 * El POS intentaba anotar el consumo con un PATCH a una ruta de Next que solo
 * exportaba GET: 405, y la llamada era fire-and-forget. Resultado: los 1083
 * socios del padron siguen en creditUsed 0 y el limite no se agota nunca.
 *
 * Aqui se prueba lo que decide si se le fia a alguien.
 */
describe('PublicService — credito de socios', () => {
  const construir = async (socio: Record<string, unknown> | null) => {
    // El documento "vive" en esta variable para que el update condicionado se
    // comporte como en Mongo: solo escribe si creditUsed sigue como se leyo.
    let actual = socio ? { ...socio } : null;

    const findOne = jest.fn(() => ({
      lean: () => ({ exec: () => Promise.resolve(actual) }),
    }));

    const findOneAndUpdate = jest.fn(
      (filtro: Record<string, unknown>, update: Record<string, any>) => ({
        lean: () => ({
          exec: () => {
            if (!actual) return Promise.resolve(null);
            const esperado = filtro.creditUsed;
            const usado = (actual.creditUsed as number) ?? 0;
            const coincide =
              typeof esperado === 'object' && esperado !== null
                ? (esperado as { $in: unknown[] }).$in.includes(usado)
                : esperado === usado;
            if (!coincide) return Promise.resolve(null);
            actual = { ...actual, creditUsed: usado + update.$inc.creditUsed };
            return Promise.resolve(actual);
          },
        }),
      }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        PublicService,
        { provide: getModelToken('AccountReceivable'), useValue: {} },
        { provide: getModelToken('Order'), useValue: {} },
        { provide: getModelToken('Customer'), useValue: { findOne: jest.fn(() => ({ select: () => ({ lean: () => ({ exec: () => Promise.resolve(null) }) }) })) } },
        {
          provide: getModelToken(Member.name),
          useValue: { findOne, findOneAndUpdate },
        },
      ],
    }).compile();

    return {
      service: moduleRef.get(PublicService),
      leer: () => actual,
      findOneAndUpdate,
    };
  };

  const SOCIO = {
    _id: '00004',
    accion: 4,
    cedula: '10665642',
    nombre: 'RODRIGUEZ JIMENEZ. MANUEL ALEJANDRO.',
    creditLimit: 50,
    creditUsed: 0,
    creditMonthsPaid: 3,
  };

  describe('accionNormalizada', () => {
    it('rellena la accion a 5 digitos, que es como esta el _id del padron', () => {
      // Pedir /members/4 daba 404 aunque el socio 00004 existiera.
      expect(accionNormalizada('4')).toBe('00004');
      expect(accionNormalizada('00004')).toBe('00004');
      expect(accionNormalizada(' 4 ')).toBe('00004');
      expect(accionNormalizada('1746')).toBe('01746');
    });
  });

  describe('consulta', () => {
    it('devuelve el credito, que es lo que el POS necesita para fiar', async () => {
      const { service } = await construir(SOCIO);
      const r = await service.getMemberLookupByAction('4');
      expect(r).toMatchObject({
        accion: 4,
        creditLimit: 50,
        creditUsed: 0,
        creditAvailable: 50,
        creditMonthsPaid: 3,
      });
    });

    it('un socio sin credito otorgado sale con 0 disponible, no undefined', async () => {
      const { service } = await construir({
        ...SOCIO,
        creditLimit: undefined,
        creditUsed: undefined,
      });
      const r = await service.getMemberLookupByAction('00004');
      expect(r).toMatchObject({ creditLimit: 0, creditAvailable: 0 });
    });
  });

  describe('registrar consumo', () => {
    it('descuenta del disponible', async () => {
      const { service, leer } = await construir(SOCIO);
      const r = await service.registrarConsumoDeCredito('4', 12.5);
      expect(r.creditUsed).toBe(12.5);
      expect(r.creditAvailable).toBe(37.5);
      expect(leer()?.creditUsed).toBe(12.5);
    });

    it('NO deja pasar mas de lo disponible', async () => {
      // Sin esto el limite es decorativo: se puede consumir sin tope.
      const { service, leer } = await construir(SOCIO);
      await expect(
        service.registrarConsumoDeCredito('4', 80),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(leer()?.creditUsed).toBe(0);
    });

    it('deja gastar el ultimo centavo justo', async () => {
      const { service } = await construir({ ...SOCIO, creditUsed: 49 });
      const r = await service.registrarConsumoDeCredito('4', 1);
      expect(r.creditAvailable).toBe(0);
    });

    it('dos cobros seguidos SUMAN, no se pisan', async () => {
      const { service, leer } = await construir(SOCIO);
      await service.registrarConsumoDeCredito('4', 10);
      await service.registrarConsumoDeCredito('4', 15);
      expect(leer()?.creditUsed).toBe(25);
    });

    it('si otro cobro se adelanta, reintenta con el valor fresco', async () => {
      const { service, leer, findOneAndUpdate } = await construir(SOCIO);
      // Simula la carrera: el primer intento falla porque creditUsed cambio.
      const real = findOneAndUpdate.getMockImplementation()!;
      let primera = true;
      findOneAndUpdate.mockImplementation((f: any, u: any) => {
        if (primera) {
          primera = false;
          return { lean: () => ({ exec: () => Promise.resolve(null) }) };
        }
        return real(f, u);
      });
      const r = await service.registrarConsumoDeCredito('4', 10);
      expect(r.creditUsed).toBe(10);
      expect(leer()?.creditUsed).toBe(10);
    });

    it('rechaza montos absurdos en vez de escribirlos', async () => {
      const { service } = await construir(SOCIO);
      for (const monto of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
        await expect(
          service.registrarConsumoDeCredito('4', monto),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
    });

    it('socio inexistente da 404, no escribe nada', async () => {
      const { service } = await construir(null);
      await expect(
        service.registrarConsumoDeCredito('99999', 5),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
