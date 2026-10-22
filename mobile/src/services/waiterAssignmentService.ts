import { api } from './api/apiClient';

interface WaiterAssignment {
  waiterId: string;
  waiterName: string;
}

interface RawWaiter {
  id?: string;
  _id?: string;
  name: string;
}

export const waiterAssignmentService = {
  /**
   * Retorna la lista de mesoneros activos.
   * NOTA: el filtro por check-in del dia se hara cuando attendance este en backend.
   * Por ahora devuelve todos los mesoneros con isActive=true.
   */
  async getActiveWaiters(): Promise<WaiterAssignment[]> {
    // Endpoint liviano accesible a todo el staff (GET /api/users es solo ADMIN
    // y daba 403 a mesoneros/cajeros)
    const users = await api.get<RawWaiter[]>('/api/users/waiters');
    return users.map((u) => ({
      waiterId: String(u.id ?? u._id ?? ''),
      waiterName: u.name,
    }));
  },

  /**
   * Asigna un mesonero a una orden usando round-robin por carga diaria.
   */
  async assignWaiter(): Promise<WaiterAssignment | null> {
    const waiters = await this.getActiveWaiters();
    if (waiters.length === 0) return null;

    // La carga la cuenta el SERVIDOR.
    //
    // Antes esta linea era `api.get<RawOrder[]>('/api/orders')` sin filtros:
    // medido el 21/09/2026, **4.766 ordenes y 1.565.064 bytes comprimidos, 2,65
    // segundos**, para terminar con media docena de numeros. Y contaba con
    // la MEDIANOCHE LOCAL (`d.getDate() === now.getDate()`), cuando la jornada del
    // restaurante va de 06:00 a 06:00 porque se cobra pasada la medianoche: a
    // la 1 AM la carga de todos volvia a cero y el reparto se rompia justo en
    // la hora de mas movimiento.
    const loadByWaiter = new Map<string, number>();
    for (const w of waiters) loadByWaiter.set(w.waiterId, 0);
    try {
      // Se llama a `api` directo y NO a `orderService.cargaPorMesonero`:
      // orderService ya importa este archivo, asi que la vuelta crearia un
      // ciclo de imports.
      const carga = await api.get<Array<{ waiterId: string; ordenes: number }>>(
        '/api/orders/carga-por-mesonero',
        { waiterIds: waiters.map((w) => w.waiterId).join(',') },
      );
      for (const fila of carga) loadByWaiter.set(fila.waiterId, fila.ordenes);
    } catch {
      // Sin carga conocida quedan todos en 0 y elige el primero: es el mismo
      // comportamiento que tenia antes cuando la peticion fallaba.
    }

    let selected = waiters[0];
    let minLoad = loadByWaiter.get(selected.waiterId) ?? 0;
    for (const w of waiters) {
      const load = loadByWaiter.get(w.waiterId) ?? 0;
      if (load < minLoad) {
        minLoad = load;
        selected = w;
      }
    }

    return selected;
  },
};
