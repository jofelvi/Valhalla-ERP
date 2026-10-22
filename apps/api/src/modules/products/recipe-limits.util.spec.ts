import { OPERACION_DEFAULT } from '@odin6/types';
import {
  MAX_INGREDIENTES,
  TOPE_DURO,
  revisarCordura,
} from './recipe-limits.util';

/**
 * Los limites salen del catalogo real (03/09/2026): 30 kg el mayor en gramos
 * (Salsa de Pizza, receta de tanda), 800 ml, 36 und (una caja de cerveza), y
 * 21 ingredientes en la receta mas larga. Todo lo real tiene que seguir
 * pasando; lo absurdo, no.
 */
describe('tope de cordura de las recetas', () => {
  const ing = (
    nombre: string,
    cantidadBase: number,
    base: 'GR' | 'ML' | 'UND',
  ) => ({
    nombre,
    cantidadBase,
    base,
  });

  describe('lo que HOY existe sigue guardandose', () => {
    it('30 kg de Salsa de Pizza pasa (es el mayor real), pero avisa', () => {
      const r = revisarCordura(
        [ing('Tomate', 30_000, 'GR')],
        OPERACION_DEFAULT.locale,
      );
      expect(r.errores).toEqual([]);
      expect(r.avisos).toHaveLength(1);
      expect(r.avisos[0]).toContain('30 kg');
    });

    it('150 g de carne no dice nada', () => {
      const r = revisarCordura(
        [ing('Carne Molida', 150, 'GR')],
        OPERACION_DEFAULT.locale,
      );
      expect(r).toEqual({ errores: [], avisos: [] });
    });

    it('la caja de 36 cervezas pasa limpia', () => {
      const r = revisarCordura(
        [ing('Cerveza Azul', 36, 'UND')],
        OPERACION_DEFAULT.locale,
      );
      expect(r).toEqual({ errores: [], avisos: [] });
    });

    it('800 ml del Broaster Familiar pasa limpio', () => {
      const r = revisarCordura(
        [ing('Aceite', 800, 'ML')],
        OPERACION_DEFAULT.locale,
      );
      expect(r).toEqual({ errores: [], avisos: [] });
    });

    it('una receta de 21 ingredientes (la mas larga real) se guarda', () => {
      const receta = Array.from({ length: 21 }, (_, i) =>
        ing(`Insumo ${i}`, 100, 'GR'),
      );
      expect(revisarCordura(receta, OPERACION_DEFAULT.locale).errores).toEqual(
        [],
      );
    });
  });

  describe('lo absurdo se frena', () => {
    it('999.999.999 kg de carne NO se guarda', () => {
      // El caso que encontro el QA: se aceptaba sin chistar.
      const r = revisarCordura(
        [ing('Carne Molida', 999_999_999_000, 'GR')],
        OPERACION_DEFAULT.locale,
      );
      expect(r.errores).toHaveLength(1);
      expect(r.errores[0]).toContain('Carne Molida');
      expect(r.errores[0]).toContain('sobra un cero');
    });

    it('el mensaje dice cuanto es el maximo, en unidad legible', () => {
      const r = revisarCordura(
        [ing('Papa', TOPE_DURO.GR + 1, 'GR')],
        OPERACION_DEFAULT.locale,
      );
      expect(r.errores[0]).toContain('50 kg');
    });

    it('cantidad cero o negativa se rechaza', () => {
      expect(
        revisarCordura([ing('Sal', 0, 'GR')], OPERACION_DEFAULT.locale).errores,
      ).toHaveLength(1);
      expect(
        revisarCordura([ing('Sal', -5, 'GR')], OPERACION_DEFAULT.locale)
          .errores,
      ).toHaveLength(1);
    });

    it('NaN e Infinity no se cuelan', () => {
      expect(
        revisarCordura([ing('X', Number.NaN, 'GR')], OPERACION_DEFAULT.locale)
          .errores,
      ).toHaveLength(1);
      expect(
        revisarCordura(
          [ing('X', Number.POSITIVE_INFINITY, 'GR')],
          OPERACION_DEFAULT.locale,
        ).errores,
      ).toHaveLength(1);
    });

    it('500 unidades pasa, 501 no', () => {
      expect(
        revisarCordura([ing('Vaso', 500, 'UND')], OPERACION_DEFAULT.locale)
          .errores,
      ).toEqual([]);
      expect(
        revisarCordura([ing('Vaso', 501, 'UND')], OPERACION_DEFAULT.locale)
          .errores,
      ).toHaveLength(1);
    });

    it('una receta pegada mil veces se frena', () => {
      const receta = Array.from({ length: MAX_INGREDIENTES + 1 }, (_, i) =>
        ing(`Insumo ${i}`, 10, 'GR'),
      );
      const r = revisarCordura(receta, OPERACION_DEFAULT.locale);
      expect(r.errores[0]).toContain('duplicaron');
    });
  });

  describe('avisar no es bloquear', () => {
    it('6 kg avisa pero deja guardar: puede ser un combo de 35 platos', () => {
      const r = revisarCordura(
        [ing('Pasta', 6_000, 'GR')],
        OPERACION_DEFAULT.locale,
      );
      expect(r.errores).toEqual([]);
      expect(r.avisos[0]).toContain('combo');
    });

    it('un error en un ingrediente no calla el aviso de otro', () => {
      const r = revisarCordura(
        [ing('Carne', 900_000, 'GR'), ing('Pasta', 6_000, 'GR')],
        OPERACION_DEFAULT.locale,
      );
      expect(r.errores).toHaveLength(1);
      expect(r.avisos).toHaveLength(1);
    });
  });
});
