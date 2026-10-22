import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { useWaiterOrderStore } from './waiterOrderStore.ts';
import type { Product } from '../types/models.ts';

const burger = {
  id: 'prod-burger-1',
  name: 'Hamburguesa Clasica',
  price: 8.5,
  categoryId: 'cat-comida',
  isActive: true,
  isForSale: true,
} as unknown as Product;

const cerveza = {
  id: 'tnZB8Weejnn5c56I6S2p',
  name: 'Pilsen Botella',
  price: 1,
  categoryId: 'cat-barra',
  isActive: true,
  isForSale: true,
} as unknown as Product;

describe('waiterOrderStore - Manejo de notas y no-fusión de líneas', () => {
  beforeEach(() => {
    useWaiterOrderStore.getState().clearOrder();
  });

  it('fusiona productos idénticos si ninguno tiene notas', () => {
    const store = useWaiterOrderStore.getState();
    store.addItem(burger, 1);
    store.addItem(burger, 2);

    const items = useWaiterOrderStore.getState().items;
    assert.equal(items.length, 1);
    assert.equal(items[0].quantity, 3);
    assert.equal(items[0].notes, undefined);
  });

  it('NO fusiona si una línea tiene nota y la otra no', () => {
    const store = useWaiterOrderStore.getState();
    store.addItem(burger, 1);
    store.addItem(burger, 1, 'sin cebolla');

    const items = useWaiterOrderStore.getState().items;
    assert.equal(items.length, 2);
    assert.equal(items[0].quantity, 1);
    assert.equal(items[0].notes, undefined);
    assert.equal(items[1].quantity, 1);
    assert.equal(items[1].notes, 'sin cebolla');
  });

  it('fusiona si ambas líneas tienen la misma nota', () => {
    const store = useWaiterOrderStore.getState();
    store.addItem(burger, 1, 'sin cebolla');
    store.addItem(burger, 2, ' sin cebolla ');

    const items = useWaiterOrderStore.getState().items;
    assert.equal(items.length, 1);
    assert.equal(items[0].quantity, 3);
    assert.equal(items[0].notes, 'sin cebolla');
  });

  it('NO fusiona si las notas son distintas', () => {
    const store = useWaiterOrderStore.getState();
    store.addItem(burger, 1, 'sin cebolla');
    store.addItem(burger, 1, 'término medio');

    const items = useWaiterOrderStore.getState().items;
    assert.equal(items.length, 2);
    assert.equal(items[0].notes, 'sin cebolla');
    assert.equal(items[1].notes, 'término medio');
  });

  it('permite editar notas por índice sin afectar otras líneas del mismo producto', () => {
    const store = useWaiterOrderStore.getState();
    store.addItem(burger, 1);
    store.addItem(burger, 1, 'sin cebolla');

    // Modificar nota de la línea 0 usando índice
    useWaiterOrderStore.getState().setItemNotes(0, 'con extra queso');

    const items = useWaiterOrderStore.getState().items;
    assert.equal(items.length, 2);
    assert.equal(items[0].notes, 'con extra queso');
    assert.equal(items[1].notes, 'sin cebolla');
  });

  it('permite actualizar cantidad por índice', () => {
    const store = useWaiterOrderStore.getState();
    store.addItem(burger, 1);
    store.addItem(burger, 1, 'sin cebolla');

    useWaiterOrderStore.getState().updateQuantity(1, 4);

    const items = useWaiterOrderStore.getState().items;
    assert.equal(items[0].quantity, 1);
    assert.equal(items[1].quantity, 4);
  });

  it('permite eliminar una línea por índice', () => {
    const store = useWaiterOrderStore.getState();
    store.addItem(burger, 1);
    store.addItem(burger, 1, 'sin cebolla');

    useWaiterOrderStore.getState().removeItem(0);

    const items = useWaiterOrderStore.getState().items;
    assert.equal(items.length, 1);
    assert.equal(items[0].notes, 'sin cebolla');
  });

  it('partir una línea por notas NO cambia el total de unidades', () => {
    const store = useWaiterOrderStore.getState();
    store.addItem(cerveza, 6);
    store.addItem(cerveza, 6, 'bien fría');

    const items = useWaiterOrderStore.getState().items;
    const unidades = items.reduce((suma, it) => suma + it.quantity, 0);

    assert.equal(items.length, 2, 'las notas distintas separan la línea');
    assert.equal(unidades, 12, 'pero el total de unidades no se mueve');
  });
});

/**
 * El cruce entre notas por ítem y conversión a packs SE PRUEBA EN LA API.
 *
 * Las notas por ítem cambiaron la identidad de la línea del carrito: antes dos
 * unidades del mismo producto se fusionaban por `productId`, ahora se separan
 * si tienen notas distintas. Eso toca los tobos: si el mesonero pide 6
 * cervezas normales y 6 "bien frías", el sistema tiene que seguir viendo 12
 * unidades del mismo producto y ofrecer el tobo.
 *
 * Esa regla se probaba acá cuando el APK calculaba la conversión. Desde el
 * 21/09/2026 el cálculo vive en el servidor (el APK solo pregunta), así que la
 * prueba se mudó con él:
 *
 *   apps/api/src/modules/orders/pack-conversion.util.spec.ts
 *   → "ofrece el tobo con 12 entregadas, aunque estén en dos líneas por las
 *      notas"
 *
 * Lo que sigue probándose acá arriba es lo que SÍ es del teléfono: que partir
 * una línea por notas no cambie el total de unidades del carrito.
 */
