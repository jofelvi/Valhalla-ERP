import { ReleaseAmbitoEnum } from '@odin6/types';
import {
  puedeRevertirse,
  type EntradaParaReversion,
} from './rollback-rules.util';

const entrada = (
  p: Partial<EntradaParaReversion> = {},
): EntradaParaReversion => ({
  id: 'r-1',
  fecha: new Date('2026-09-01T12:00:00Z'),
  ambito: [ReleaseAmbitoEnum.API],
  shas: { api: 'a1b2c3d' },
  migroDatos: false,
  titulo: 'Un cambio cualquiera',
  ...p,
});

describe('puedeRevertirse', () => {
  it('permite revertir cuando no hubo migraciones despues', () => {
    const v = puedeRevertirse(entrada(), ReleaseAmbitoEnum.API, []);
    expect(v.reversible).toBe(true);
  });

  it('BLOQUEA si una entrada posterior del mismo ambito movio datos', () => {
    const posterior = entrada({
      id: 'r-2',
      fecha: new Date('2026-09-03T12:00:00Z'),
      migroDatos: true,
      titulo: 'Inventario al entregar',
    });
    const v = puedeRevertirse(entrada(), ReleaseAmbitoEnum.API, [posterior]);
    expect(v.reversible).toBe(false);
    expect(v.motivo).toContain('Inventario al entregar');
  });

  it('NO bloquea si la migracion posterior fue de otro ambito', () => {
    const posterior = entrada({
      id: 'r-2',
      fecha: new Date('2026-09-03T12:00:00Z'),
      ambito: [ReleaseAmbitoEnum.WEB],
      shas: { web: 'ffffff1' },
      migroDatos: true,
    });
    const v = puedeRevertirse(entrada(), ReleaseAmbitoEnum.API, [posterior]);
    expect(v.reversible).toBe(true);
  });

  it('el APK nunca es reversible', () => {
    const apk = entrada({
      ambito: [ReleaseAmbitoEnum.APK],
      shas: {},
      version: 'v1.2.1',
    });
    const v = puedeRevertirse(apk, ReleaseAmbitoEnum.APK, []);
    expect(v.reversible).toBe(false);
    expect(v.motivo).toContain('telefonos');
  });

  it('no es reversible si no se guardo el sha de ese ambito', () => {
    const v = puedeRevertirse(entrada({ shas: {} }), ReleaseAmbitoEnum.API, []);
    expect(v.reversible).toBe(false);
    expect(v.motivo).toContain('no hay a donde volver');
  });

  it('no es reversible si la entrada no toco ese ambito', () => {
    const v = puedeRevertirse(entrada(), ReleaseAmbitoEnum.WEB, []);
    expect(v.reversible).toBe(false);
    expect(v.motivo).toContain('no toco');
  });

  it('ignora entradas anteriores aunque hayan migrado datos', () => {
    const anterior = entrada({
      id: 'r-0',
      fecha: new Date('2026-08-20T12:00:00Z'),
      migroDatos: true,
    });
    const v = puedeRevertirse(entrada(), ReleaseAmbitoEnum.API, [anterior]);
    expect(v.reversible).toBe(true);
  });
});
