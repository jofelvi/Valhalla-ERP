import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Nómina de la semana en PDF, con el desglose por ítem y los totales.
 *
 * El dueño necesitaba saber "el monto exacto y el desglose de cada uno de los
 * ítems": cuánto de sueldo, cuánto de comisión, cuánto de propina y qué se
 * descontó. Antes eso solo existía repartido en la pantalla, fila por fila, y
 * no había forma de archivarlo ni de mandarlo.
 */

export interface FilaNominaPdf {
  empleado: string;
  cargo: string;
  dias: number;
  tarifa: number;
  sueldo: number;
  comision: number;
  propina: number;
  bonos: number;
  descuentos: number;
  neto: number;
  pagado: boolean;
}

const C = {
  amber: [245, 158, 11] as const,
  dark: [28, 25, 23] as const,
  text: [41, 37, 36] as const,
  gris: [120, 113, 108] as const,
  fondo: [250, 250, 249] as const,
};

// Con guion normal, NO el menos unicode (−): las fuentes estándar del PDF no
// lo tienen y jsPDF lo parte en caracteres sueltos ("\" $ 1 . 3 5").
const usd = (n: number): string => `$${(Math.round(n * 100) / 100).toFixed(2)}`;

export function generarPdfNomina(
  filas: FilaNominaPdf[],
  semanaInicio: Date,
  semanaFin: Date,
  nombreNegocio: string,
  tasaBcv?: number,
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const ancho = doc.internal.pageSize.getWidth();

  // ── Encabezado ────────────────────────────────────────────────────────────
  doc.setFillColor(...C.dark);
  doc.rect(0, 0, ancho, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`${nombreNegocio} - Nomina semanal`, 14, 10);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const rango = `${format(semanaInicio, "d 'de' MMMM", { locale: es })} al ${format(
    semanaFin,
    "d 'de' MMMM 'de' yyyy",
    { locale: es },
  )}`;
  doc.text(rango, 14, 16);

  const emitido = `Emitido ${format(new Date(), "d/MM/yyyy 'a las' HH:mm", {
    locale: es,
  })}`;
  doc.text(emitido, ancho - 14, 16, { align: 'right' });

  // ── Tabla ─────────────────────────────────────────────────────────────────
  const totales = filas.reduce(
    (acc, f) => ({
      sueldo: acc.sueldo + f.sueldo,
      comision: acc.comision + f.comision,
      propina: acc.propina + f.propina,
      bonos: acc.bonos + f.bonos,
      descuentos: acc.descuentos + f.descuentos,
      neto: acc.neto + f.neto,
    }),
    { sueldo: 0, comision: 0, propina: 0, bonos: 0, descuentos: 0, neto: 0 },
  );

  autoTable(doc, {
    startY: 28,
    head: [
      [
        'Empleado',
        'Cargo',
        'Días',
        'Tarifa',
        'Sueldo',
        'Comisión',
        'Propina',
        'Bonos',
        'Descuentos',
        'Neto',
        'Estado',
      ],
    ],
    body: filas.map((f) => [
      f.empleado,
      f.cargo,
      String(f.dias),
      f.tarifa > 0 ? usd(f.tarifa) : '-',
      usd(f.sueldo),
      f.comision > 0 ? usd(f.comision) : '-',
      f.propina > 0 ? usd(f.propina) : '-',
      f.bonos > 0 ? `+${usd(f.bonos)}` : '-',
      f.descuentos > 0 ? `-${usd(f.descuentos)}` : '-',
      usd(f.neto),
      f.pagado ? 'Pagado' : 'Pendiente',
    ]),
    foot: [
      [
        'TOTALES',
        '',
        '',
        '',
        usd(totales.sueldo),
        usd(totales.comision),
        usd(totales.propina),
        `+${usd(totales.bonos)}`,
        `-${usd(totales.descuentos)}`,
        usd(totales.neto),
        '',
      ],
    ],
    styles: { fontSize: 8, cellPadding: 2, textColor: [...C.text] },
    headStyles: { fillColor: [...C.amber], textColor: 255, fontStyle: 'bold' },
    footStyles: {
      fillColor: [...C.dark],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: [...C.fondo] },
    columnStyles: {
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right', fontStyle: 'bold' },
      10: { halign: 'center' },
    },
  });

  // ── Resumen al pie ────────────────────────────────────────────────────────
  const finTabla =
    (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 8;

  doc.setFontSize(9);
  doc.setTextColor(...C.text);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total a pagar: ${usd(totales.neto)}`, 14, finTabla);

  if (tasaBcv && tasaBcv > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.gris);
    doc.text(
      `Equivale a Bs ${(totales.neto * tasaBcv).toLocaleString('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} (tasa ${tasaBcv})`,
      14,
      finTabla + 5,
    );
  }

  // Las propinas se muestran aparte a propósito: no son gasto del negocio,
  // son del mesonero y solo pasan por la nómina.
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.gris);
  doc.setFontSize(8);
  doc.text(
    `De ese total, ${usd(totales.propina)} son propinas del cliente (no son gasto del negocio).`,
    14,
    finTabla + (tasaBcv ? 11 : 6),
  );

  const nombre = `nomina-${format(semanaInicio, 'yyyy-MM-dd')}.pdf`;
  doc.save(nombre);
}
