import {
  decideAutoRelease,
  PENDING_ORDER_PLACEHOLDER,
  TableSweepState,
} from './table-auto-release';

const NOW = new Date('2026-07-27T20:00:00Z').getTime();
const minsAgo = (n: number) => new Date(NOW - n * 60 * 1000);

const table = (over: Partial<TableSweepState> = {}): TableSweepState => ({
  _id: 't1',
  name: 'Mesa 1',
  status: 'OCCUPIED',
  isAvailable: false,
  orderId: null,
  claimedBy: null,
  claimedAt: null,
  lastHeartbeatAt: null,
  updatedAt: minsAgo(10),
  ...over,
});

const decide = (t: TableSweepState, hasRealOrder = false) =>
  decideAutoRelease(t, { hasRealOrder, now: NOW });

describe('decideAutoRelease', () => {
  describe('blindaje: nunca tocar una mesa con orden real', () => {
    it('mesa con orden real activa NO se libera, por vieja que sea', () => {
      const t = table({ orderId: 'ord-1', updatedAt: minsAgo(600) });
      expect(decide(t, true)).toBeNull();
    });

    it('mesa con orden real y ademas claim viejo NO se libera', () => {
      const t = table({
        orderId: 'ord-1',
        claimedBy: 'u1',
        claimedAt: minsAgo(120),
      });
      expect(decide(t, true)).toBeNull();
    });
  });

  describe('mesa libre', () => {
    it('mesa disponible sin nada no genera accion', () => {
      const t = table({ isAvailable: true, status: 'ISAVAILABLE' });
      expect(decide(t)).toBeNull();
    });
  });

  describe('claim del mesonero (el caso reportado)', () => {
    it('claim con heartbeat reciente NO se libera (alguien esta en la mesa)', () => {
      const t = table({
        claimedBy: 'u1',
        claimedAt: minsAgo(10),
        lastHeartbeatAt: minsAgo(1),
      });
      expect(decide(t)).toBeNull();
    });

    it('claim sin heartbeat por 2+ min SE libera (ya nadie esta)', () => {
      const t = table({
        claimedBy: 'u1',
        claimedAt: minsAgo(10),
        lastHeartbeatAt: minsAgo(3),
      });
      expect(decide(t)).toBe('claim-inactivo');
    });

    it('claim recien creado que nunca latio NO se libera de inmediato', () => {
      const t = table({ claimedBy: 'u1', claimedAt: minsAgo(0.5) });
      expect(decide(t)).toBeNull();
    });

    it('claim que nunca latio y ya pasaron 2+ min SE libera', () => {
      const t = table({ claimedBy: 'u1', claimedAt: minsAgo(3) });
      expect(decide(t)).toBe('claim-inactivo');
    });

    it('claim que sigue latiendo pero lleva 30+ min SE libera (tope absoluto)', () => {
      const t = table({
        claimedBy: 'u1',
        claimedAt: minsAgo(45),
        lastHeartbeatAt: minsAgo(0.2),
      });
      expect(decide(t)).toBe('claim-tope-absoluto');
    });

    it('claim sin fecha (dato corrupto) SE libera', () => {
      const t = table({ claimedBy: 'u1', claimedAt: null });
      expect(decide(t)).toBe('claim-inactivo');
    });
  });

  describe('punto ciego 1: ocupada sin orden y sin claim', () => {
    it('huerfana vieja SE libera (antes quedaba pegada para siempre)', () => {
      const t = table({ claimedBy: null, updatedAt: minsAgo(5) });
      expect(decide(t)).toBe('huerfana-sin-claim');
    });

    it('huerfana recien tocada NO se libera (puede ser operacion en curso)', () => {
      const t = table({ claimedBy: null, updatedAt: minsAgo(0.5) });
      expect(decide(t)).toBeNull();
    });
  });

  describe('punto ciego 2: creacion de orden atascada', () => {
    it('placeholder recien puesto NO se toca (orden creandose)', () => {
      const t = table({
        orderId: PENDING_ORDER_PLACEHOLDER,
        updatedAt: minsAgo(0.1),
      });
      expect(decide(t)).toBeNull();
    });

    it('placeholder viejo SE libera (la creacion fallo a medias)', () => {
      const t = table({
        orderId: PENDING_ORDER_PLACEHOLDER,
        updatedAt: minsAgo(5),
      });
      expect(decide(t)).toBe('creacion-orden-atascada');
    });
  });

  describe('orden borrada dejando la mesa ocupada', () => {
    it('orderId que apunta a orden inexistente SE libera', () => {
      const t = table({ orderId: 'ord-borrada' });
      expect(decide(t, false)).toBe('orden-inexistente');
    });
  });
});
