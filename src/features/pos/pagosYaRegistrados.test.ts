import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { debenContarsePagosPrevios } from './pagosYaRegistrados.ts';

describe('debenContarsePagosPrevios', () => {
  it('CREDIT/pending: cuenta lo ya cobrado — el caso que dejó trabada la 180926-0004', () => {
    // La orden del reporte del dueño (21/09/2026): total $73,45, el mesonero
    // ya había cobrado $73,48 en tres pagos, y la pantalla los ignoraba porque
    // el estado era `pending` y no `partial`. Sin esto no aparecía la salida
    // "Finalizar — esta cuenta ya está pagada" y el botón grande quedaba en
    // "Ingrese un monto" deshabilitado.
    assert.equal(debenContarsePagosPrevios('pending'), true);
  });

  it('partial: sigue contándolos (las 37 órdenes que ya funcionaban)', () => {
    assert.equal(debenContarsePagosPrevios('partial'), true);
  });

  it('pending_verification y cancelled también cuentan', () => {
    // `cancelled` hoy se ve en `partial` y muestra sus abonos: quitárselos
    // sería una regresión sobre algo que ya anda.
    assert.equal(debenContarsePagosPrevios('pending_verification'), true);
    assert.equal(debenContarsePagosPrevios('cancelled'), true);
  });

  it('paid: NO — ya está cerrada, la pantalla de cobro no se usa', () => {
    assert.equal(debenContarsePagosPrevios('paid'), false);
  });

  it('refunded: NO — el dinero se devolvió', () => {
    // Contarlos pondría el restante en $0 y dibujaría "Finalizar — esta cuenta
    // ya está pagada" sobre una orden reembolsada.
    assert.equal(debenContarsePagosPrevios('refunded'), false);
  });

  it('sin estado (orden aún cargando): cuenta, y la lista vacía lo hace inocuo', () => {
    assert.equal(debenContarsePagosPrevios(undefined), true);
  });
});
