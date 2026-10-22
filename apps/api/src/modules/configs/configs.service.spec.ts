import { CONFIG_DEFAULTS } from '@odin6/types';
import { Connection } from 'mongoose';
import { ConfigsService } from './configs.service';

/** Colección en memoria con la misma forma que usa el servicio. */
function conexionFalsa(inicial: Record<string, Record<string, unknown>> = {}) {
  const docs = new Map(Object.entries(inicial));
  const findOne = jest.fn(async ({ _id }: { _id: string }) => docs.get(_id) ?? null);
  const updateOne = jest.fn(
    async (
      { _id }: { _id: string },
      { $set }: { $set: Record<string, unknown> },
    ) => {
      docs.set(_id, { _id, ...(docs.get(_id) ?? {}), ...$set });
    },
  );
  const connection = {
    collection: () => ({ findOne, updateOne }),
  } as unknown as Connection;
  return { connection, findOne, updateOne, docs };
}

describe('ConfigsService', () => {
  it('sin documento sirve los valores neutros y lo marca como no configurado', async () => {
    const { connection } = conexionFalsa();
    const svc = new ConfigsService(connection);
    const env = await svc.obtenerEnvelope('tarifas');
    expect(env.valor).toEqual(CONFIG_DEFAULTS.tarifas);
    expect(env.configured).toBe(false);
    expect((await svc.publico()).configured).toBe(false);
  });

  it('un documento corrupto no rompe: se normaliza', async () => {
    const { connection } = conexionFalsa({
      tarifas: { _id: 'tarifas', valor: { serviceRate: 'mucho', serviceMode: 9 } },
    });
    const svc = new ConfigsService(connection);
    expect((await svc.obtener('tarifas')).serviceRate).toBe(
      CONFIG_DEFAULTS.tarifas.serviceRate,
    );
  });

  it('cachea la lectura y la invalida al escribir', async () => {
    const { connection, findOne } = conexionFalsa();
    const svc = new ConfigsService(connection);
    await svc.obtener('operacion');
    await svc.obtener('operacion');
    expect(findOne).toHaveBeenCalledTimes(1);

    await svc.actualizar('operacion', { businessDayStartHour: 4 }, 'admin-1');
    expect((await svc.obtener('operacion')).businessDayStartHour).toBe(4);
  });

  it('actualizar mezcla un campo sin perder el resto y guarda quién lo hizo', async () => {
    const { connection, docs } = conexionFalsa();
    const svc = new ConfigsService(connection);
    await svc.actualizar('tarifas', { serviceRate: 0.12 }, 'u1');
    const env = await svc.actualizar('tarifas', { tax: { enabled: true } }, 'u2');
    expect(env.valor.serviceRate).toBe(0.12);
    expect(env.valor.tax.enabled).toBe(true);
    expect(env.configured).toBe(true);
    expect(env.updatedBy).toBe('u2');
    expect(docs.get('tarifas')?.updatedBy).toBe('u2');
  });

  it('lo inválido en un PATCH se descarta, no se guarda', async () => {
    const { connection } = conexionFalsa();
    const svc = new ConfigsService(connection);
    const env = await svc.actualizar(
      'marca',
      { logoLightUrl: 'javascript:alert(1)' },
      null,
    );
    expect(env.valor.logoLightUrl).toBe('');
  });

  it('publico incluye todo menos nómina y marca configurado al fijar el nombre', async () => {
    const { connection } = conexionFalsa();
    const svc = new ConfigsService(connection);
    await svc.actualizar('negocio', { tradeName: 'Sabor' }, null);
    const pub = await svc.publico();
    expect(pub.configured).toBe(true);
    expect(pub.negocio.tradeName).toBe('Sabor');
    expect(Object.keys(pub)).not.toContain('nomina');
  });

  it('una caída de Mongo en la lectura sirve valores neutros', async () => {
    const connection = {
      collection: () => ({
        findOne: jest.fn().mockRejectedValue(new Error('down')),
        updateOne: jest.fn(),
      }),
    } as unknown as Connection;
    const svc = new ConfigsService(connection);
    expect((await svc.obtener('modulos')).partners).toBe(false);
  });
});
