import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PaymentMethodEnum } from '@odin6/types';
import { useCobroStore } from './useCobroStore.ts';

// El estado es un singleton: se limpia antes de cada caso para que un test no
// contamine al siguiente (el mismo riesgo que el store protege en producción).
beforeEach(() => {
  useCobroStore.getState().reset();
});

// `order` mínimo suficiente para toggleSplitMode (solo mira items[].quantity).
const ordenFalsa = (id: string, cantidades: number[]) =>
  ({
    id,
    items: cantidades.map((quantity) => ({ quantity })),
  }) as unknown as Parameters<
    ReturnType<typeof useCobroStore.getState>['toggleSplitMode']
  >[0];

describe('useCobroStore — candados anti-sangrado', () => {
  test('ensureOrder fija el orderId en la primera orden', () => {
    useCobroStore.getState().ensureOrder('orden-A');
    assert.equal(useCobroStore.getState().orderId, 'orden-A');
  });

  test('abrir OTRA orden purga el estado de la anterior (dinero no sangra)', () => {
    // Orden A: el cajero capturó de TODO — división, tarjeta, ítem a borrar,
    // métodos+montos, pago móvil y propina.
    const s = useCobroStore.getState();
    s.ensureOrder('orden-A');
    s.toggleSplitMode(ordenFalsa('orden-A', [2, 1]));
    s.updateCardPayment(0, 'amount', '500');
    s.askDeleteItem({ index: 1, name: 'Cerveza' });
    s.setSelectedPaymentMethods([PaymentMethodEnum.CASH_USD]);
    s.setPaymentAmounts((prev) => ({
      ...prev,
      [PaymentMethodEnum.CASH_USD]: '20',
    }));
    s.setPagoMovilData((prev) => ({
      ...prev,
      amount: '750',
      reference: 'ABC',
    }));
    s.setTipAmount(3);
    s.setSelectedTip(3);
    assert.equal(useCobroStore.getState().splitMode, true);
    assert.equal(
      useCobroStore.getState().paymentAmounts[PaymentMethodEnum.CASH_USD],
      '20',
    );
    assert.equal(useCobroStore.getState().tipAmount, 3);

    // Cierra A y abre B: TODO el money-core DEBE quedar en cero salvo el nuevo
    // orderId. Clave money-crítica: ni un bolívar ni un método de A visible en B;
    // y itemToDelete (un index) no sobrevive → no se borra el ítem equivocado.
    useCobroStore.getState().ensureOrder('orden-B');
    const b = useCobroStore.getState();
    assert.equal(b.orderId, 'orden-B');
    assert.equal(b.splitMode, false);
    assert.equal(b.splitSelection.size, 0);
    assert.equal(b.cardPayments.length, 1);
    assert.equal(b.cardPayments[0].amount, '');
    assert.equal(b.itemToDelete, null);
    assert.equal(b.showDeleteConfirm, false);
    assert.deepEqual(b.selectedPaymentMethods, []);
    assert.equal(b.paymentAmounts[PaymentMethodEnum.CASH_USD], '');
    assert.equal(b.pagoMovilData.amount, '');
    assert.equal(b.pagoMovilData.reference, '');
    assert.equal(b.tipAmount, 0);
    assert.equal(b.selectedTip, null);
  });

  test('ensureOrder con el MISMO orderId no borra el estado en progreso', () => {
    const s = useCobroStore.getState();
    s.ensureOrder('orden-A');
    s.handleSplitToggleItem(0, 3);
    assert.equal(useCobroStore.getState().splitSelection.get(0), 3);

    // Re-render de la pantalla: mismo orderId → no debe resetear la selección.
    useCobroStore.getState().ensureOrder('orden-A');
    assert.equal(useCobroStore.getState().splitSelection.get(0), 3);
  });

  test('reset deja el estado inicial y el orderId en null', () => {
    const s = useCobroStore.getState();
    s.ensureOrder('orden-A');
    s.toggleSplitMode(ordenFalsa('orden-A', [1]));

    useCobroStore.getState().reset();
    const r = useCobroStore.getState();
    assert.equal(r.orderId, null);
    assert.equal(r.splitMode, false);
    assert.equal(r.splitSelection.size, 0);
  });

  test('cada reset entrega un Map fresco (no una referencia compartida)', () => {
    useCobroStore.getState().handleSplitToggleItem(0, 5);
    const mapa1 = useCobroStore.getState().splitSelection;
    useCobroStore.getState().reset();
    const mapa2 = useCobroStore.getState().splitSelection;
    assert.notEqual(mapa1, mapa2);
    assert.equal(mapa2.size, 0);
  });
});

describe('useCobroStore — división de cuenta', () => {
  test('toggleSplitMode al activar selecciona todos los ítems con su cantidad', () => {
    useCobroStore.getState().toggleSplitMode(ordenFalsa('orden-A', [2, 5, 1]));
    const s = useCobroStore.getState();
    assert.equal(s.splitMode, true);
    assert.equal(s.splitSelection.size, 3);
    assert.equal(s.splitSelection.get(0), 2);
    assert.equal(s.splitSelection.get(1), 5);
    assert.equal(s.splitSelection.get(2), 1);
  });

  test('toggleSplitMode al desactivar apaga el modo', () => {
    const orden = ordenFalsa('orden-A', [1]);
    useCobroStore.getState().toggleSplitMode(orden);
    useCobroStore.getState().toggleSplitMode(orden);
    assert.equal(useCobroStore.getState().splitMode, false);
  });

  test('handleSplitToggleItem agrega y quita un ítem', () => {
    const s = useCobroStore.getState();
    s.handleSplitToggleItem(1, 4);
    assert.equal(useCobroStore.getState().splitSelection.get(1), 4);
    useCobroStore.getState().handleSplitToggleItem(1, 4);
    assert.equal(useCobroStore.getState().splitSelection.has(1), false);
  });

  test('handleSplitQtyChange topa en maxQty y borra en 0', () => {
    const s = useCobroStore.getState();
    s.handleSplitQtyChange(0, 10, 3); // pide 10, hay 3 → tope 3
    assert.equal(useCobroStore.getState().splitSelection.get(0), 3);
    useCobroStore.getState().handleSplitQtyChange(0, 0, 3); // 0 → borra
    assert.equal(useCobroStore.getState().splitSelection.has(0), false);
  });

  test('setSplitSelection acepta valor directo y función actualizadora', () => {
    useCobroStore.getState().setSplitSelection(new Map([[2, 1]]));
    assert.equal(useCobroStore.getState().splitSelection.get(2), 1);
    useCobroStore.getState().setSplitSelection((prev) => {
      const next = new Map(prev);
      next.set(3, 2);
      return next;
    });
    assert.equal(useCobroStore.getState().splitSelection.get(3), 2);
    assert.equal(useCobroStore.getState().splitSelection.get(2), 1);
  });
});

describe('useCobroStore — tarjetas', () => {
  test('addCardPayment agrega una fila vacía', () => {
    useCobroStore.getState().addCardPayment();
    assert.equal(useCobroStore.getState().cardPayments.length, 2);
  });

  test('updateCardPayment cambia solo el campo indicado de esa tarjeta', () => {
    const s = useCobroStore.getState();
    s.addCardPayment();
    s.updateCardPayment(1, 'reference', 'REF-9');
    const cards = useCobroStore.getState().cardPayments;
    assert.equal(cards[1].reference, 'REF-9');
    assert.equal(cards[0].reference, '');
  });

  test('removeCardPayment quita la fila indicada sin tocar CARD si quedan otras', () => {
    const s = useCobroStore.getState();
    s.setSelectedPaymentMethods([PaymentMethodEnum.CARD]);
    s.addCardPayment(); // ahora hay 2
    s.removeCardPayment(0);
    assert.equal(useCobroStore.getState().cardPayments.length, 1);
    // Quedan tarjetas → CARD sigue seleccionado.
    assert.deepEqual(useCobroStore.getState().selectedPaymentMethods, [
      PaymentMethodEnum.CARD,
    ]);
  });

  test('quitar la ÚLTIMA tarjeta restaura fila vacía y deselecciona CARD', () => {
    const s = useCobroStore.getState();
    s.setSelectedPaymentMethods([
      PaymentMethodEnum.CASH_USD,
      PaymentMethodEnum.CARD,
    ]);
    s.updateCardPayment(0, 'amount', '100');
    s.removeCardPayment(0);
    const r = useCobroStore.getState();
    assert.equal(r.cardPayments.length, 1);
    assert.equal(r.cardPayments[0].amount, '');
    // Se quitó la última → CARD fuera, el resto de métodos intacto.
    assert.deepEqual(r.selectedPaymentMethods, [PaymentMethodEnum.CASH_USD]);
  });
});

describe('useCobroStore — edición de ítems', () => {
  test('askDeleteItem marca el ítem y abre el modal', () => {
    useCobroStore.getState().askDeleteItem({ index: 2, name: 'Pizza' });
    const s = useCobroStore.getState();
    assert.equal(s.itemToDelete?.index, 2);
    assert.equal(s.itemToDelete?.name, 'Pizza');
    assert.equal(s.showDeleteConfirm, true);
  });

  test('clearDeleteItem cierra el modal y limpia el ítem', () => {
    const s = useCobroStore.getState();
    s.askDeleteItem({ index: 2, name: 'Pizza' });
    useCobroStore.getState().clearDeleteItem();
    const r = useCobroStore.getState();
    assert.equal(r.itemToDelete, null);
    assert.equal(r.showDeleteConfirm, false);
  });
});
