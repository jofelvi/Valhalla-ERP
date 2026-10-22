import { buildCajaSummary, buildComanda } from './escpos/receiptBuilder';
import { ComandaItem, ComandaRequest } from './types/printRequest';

/**
 * Qué papeles salen por una comanda y por qué impresora, SIN imprimir nada.
 *
 * Lo usan el endpoint que imprime (`/print-comanda`) y el de vista previa (`/preview-comanda`):
 * así lo que se ve en la vista previa es exactamente lo que saldría.
 */

export type StationMode =
  | 'both'
  | 'kitchen'
  | 'bar'
  | 'bar-1'
  | 'bar-2'
  | 'kitchen+1';

export type EtiquetaPapel = 'COCINA' | 'PIZZA' | 'BARRA' | 'CAJA';

export interface PapelPlaneado {
  etiqueta: EtiquetaPapel;
  /** Título que lleva el papel (p. ej. "BARRA 1"). */
  titulo: string;
  impresora: string;
  items: number;
  buffer: Buffer;
}

export interface OpcionesPlan {
  modo: StationMode;
  impresoras: { cocina: string; pizza: string; barra: string; caja: string };
  /** Papel extra de resumen en la impresora de caja. Apagado salvo `RESUMEN_CAJA=1`. */
  resumenCaja: boolean;
  /** Qué items de barra salen en este equipo según el modo (barra 1 / barra 2). */
  filtroBarra: (items: ComandaItem[], data: ComandaRequest) => ComandaItem[];
}

export interface PlanDeComanda {
  papeles: PapelPlaneado[];
  /** Lo que NO sale en este equipo y por qué (modo de estación). */
  omitidos: string[];
  /** Cosas que el operador debe saber: impresoras compartidas, resumen de caja, etc. */
  avisos: string[];
}

const COCINA_ACTIVA: StationMode[] = ['both', 'kitchen', 'kitchen+1'];
const BARRA_ACTIVA: StationMode[] = [
  'both',
  'bar',
  'bar-1',
  'bar-2',
  'kitchen+1',
];

export function planearComanda(
  data: ComandaRequest,
  o: OpcionesPlan,
): PlanDeComanda {
  const items = Array.isArray(data.items) ? data.items : [];
  const papeles: PapelPlaneado[] = [];
  const omitidos: string[] = [];

  // Reparto SOLO por el campo `station` del item. Sin station → cocina.
  const deBarra = items.filter((i) => i?.station === 'BAR');
  const dePizza = items.filter((i) => i?.station === 'PIZZA');
  const deCocina = items.filter(
    (i) => i?.station !== 'BAR' && i?.station !== 'PIZZA',
  );
  const cocinaActiva = COCINA_ACTIVA.includes(o.modo);

  if (deCocina.length > 0) {
    if (cocinaActiva) {
      papeles.push({
        etiqueta: 'COCINA',
        titulo: 'COCINA',
        impresora: o.impresoras.cocina,
        items: deCocina.length,
        buffer: buildComanda({ ...data, items: deCocina }, 'COCINA'),
      });
    } else {
      omitidos.push(`${deCocina.length} items de cocina (modo ${o.modo})`);
    }
  }

  if (dePizza.length > 0) {
    if (cocinaActiva) {
      papeles.push({
        etiqueta: 'PIZZA',
        titulo: 'PIZZA',
        impresora: o.impresoras.pizza,
        items: dePizza.length,
        buffer: buildComanda({ ...data, items: dePizza }, 'PIZZA'),
      });
    } else {
      omitidos.push(`${dePizza.length} items de pizza (modo ${o.modo})`);
    }
  }

  if (deBarra.length > 0) {
    if (BARRA_ACTIVA.includes(o.modo)) {
      const paraEsteModo = o.filtroBarra(deBarra, data);
      if (paraEsteModo.length > 0) {
        const titulo =
          o.modo === 'bar-1'
            ? 'BARRA 1'
            : o.modo === 'bar-2'
              ? 'BARRA 2'
              : 'BARRA';
        papeles.push({
          etiqueta: 'BARRA',
          titulo,
          impresora: o.impresoras.barra,
          items: paraEsteModo.length,
          buffer: buildComanda({ ...data, items: paraEsteModo }, titulo),
        });
      } else {
        omitidos.push(`${deBarra.length} items de barra (van a la otra barra)`);
      }
    } else {
      omitidos.push(`${deBarra.length} items de barra (modo ${o.modo})`);
    }
  }

  if (o.resumenCaja && cocinaActiva && items.length > 0) {
    papeles.push({
      etiqueta: 'CAJA',
      titulo: 'RESUMEN CAJA',
      impresora: o.impresoras.caja,
      items: items.length,
      buffer: buildCajaSummary({ ...data, items }),
    });
  }

  return { papeles, omitidos, avisos: avisosDe(papeles, o) };
}

function avisosDe(papeles: PapelPlaneado[], o: OpcionesPlan): string[] {
  const avisos: string[] = [];
  const porImpresora = new Map<string, string[]>();
  for (const p of papeles) {
    porImpresora.set(p.impresora, [
      ...(porImpresora.get(p.impresora) ?? []),
      p.etiqueta,
    ]);
  }
  for (const [impresora, etiquetas] of porImpresora) {
    if (etiquetas.length > 1) {
      avisos.push(
        `${etiquetas.join(' + ')} salen por la MISMA impresora (${impresora}): ` +
          `saldrán ${etiquetas.length} papeles seguidos en el mismo rollo.`,
      );
    }
  }
  if (o.resumenCaja) {
    avisos.push(
      'El resumen de caja está ENCENDIDO (RESUMEN_CAJA=1): sale un papel más por cada pedido.',
    );
  }
  return avisos;
}
