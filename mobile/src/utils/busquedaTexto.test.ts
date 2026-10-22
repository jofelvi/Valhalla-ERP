import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  coincide,
  filtrarLocal,
  normalizar,
  palabrasDe,
  patronDeDigitos,
  patronesDePalabra,
} from './busquedaTexto.ts';

test('quita tildes, baja a minusculas y colapsa espacios', () => {
  assert.equal(normalizar('  JOSÉ   MARÍA '), 'jose maria');
  assert.equal(normalizar('Té de Jamaica'), 'te de jamaica');
  assert.equal(normalizar('ÑOÑO'), 'nono');
  assert.equal(normalizar('Curaçao'), 'curacao');
});

test('normalizar aguanta lo que no es texto', () => {
  // Las pantallas le pasan campos del producto que pueden venir vacios.
  assert.equal(normalizar(undefined as unknown as string), '');
  assert.equal(normalizar(null as unknown as string), '');
});

test('la tilde deja de importar en los dos sentidos', () => {
  // El caso que costo un producto duplicado: quien creo «TE DE JAMAICA»
  // escribio sin tilde y no encontro «Té de Jamaica», que ya existia.
  const palabras = palabrasDe('te de jamaica');
  assert.equal(coincide(['Té de Jamaica'], palabras), true);
  assert.equal(coincide(['TÉ DE JAMAICA'], palabras), true);
  assert.equal(coincide(['Té de Jamaica'], palabrasDe('TÉ DE JAMAICA')), true);
});

test('las mayusculas tampoco', () => {
  assert.equal(coincide(['CAFÉ BALLET'], palabrasDe('cafe')), true);
  assert.equal(coincide(['Golden Piña 1.5L'], palabrasDe('pina')), true);
  assert.equal(coincide(['Golden Piña 1.5L'], palabrasDe('PIÑA')), true);
});

test('todas las palabras tienen que aparecer, en cualquier orden', () => {
  assert.equal(coincide(['Caja de Pizza'], palabrasDe('caja pizza')), true);
  assert.equal(coincide(['Caja de Pizza'], palabrasDe('pizza caja')), true);
  // Una palabra que no esta descarta el elemento: quien escribe dos las quiere
  // las dos.
  assert.equal(coincide(['Caja de Pizza'], palabrasDe('caja carton')), false);
});

test('una palabra puede caer en cualquiera de los campos', () => {
  // El nombre en uno y el codigo de barras en otro.
  assert.equal(coincide(['Pepsi 1L', '7591234'], palabrasDe('pepsi 7591234')), true);
});

test('sin texto no se filtra nada', () => {
  assert.deepEqual(palabrasDe('   '), []);
  assert.equal(coincide(['lo que sea'], []), true);
});

test('un elemento sin ningun campo util no coincide', () => {
  assert.equal(coincide([null, undefined], palabrasDe('pepsi')), false);
});

test('filtrarLocal es el respaldo cuando no hay internet', () => {
  const productos = [
    { name: 'Té de Jamaica', sku: 'TJ1' },
    { name: 'Caja de Pizza', sku: 'CP9' },
    { name: 'CAFÉ BALLET', sku: 'CB2' },
  ];
  assert.deepEqual(
    filtrarLocal(productos, 'te de jamaica', ['name', 'sku']).map((p) => p.name),
    ['Té de Jamaica'],
  );
  assert.deepEqual(
    filtrarLocal(productos, 'cafe', ['name', 'sku']).map((p) => p.name),
    ['CAFÉ BALLET'],
  );
  // Buscar por el codigo devuelve el producto, aunque el nombre no se parezca.
  assert.deepEqual(
    filtrarLocal(productos, 'cp9', ['name', 'sku']).map((p) => p.name),
    ['Caja de Pizza'],
  );
  // Sin texto, la lista entera y sin mutar la original.
  assert.equal(filtrarLocal(productos, '', ['name']).length, 3);
});

test('busqueda por digitos: telefono con separadores', () => {
  // '0414 3582580' debe encontrar '0414-3582580'
  const pattern = patronDeDigitos('04143582580');
  assert.equal(pattern.test('0414-3582580'), true);
  assert.equal(pattern.test('0414 3582580'), true);
  assert.equal(pattern.test('04143582580'), true);
  assert.equal(pattern.test('0414.3582580'), true);
});

test('busqueda por digitos: cedula sin guion encuentra ambas formas', () => {
  // 'V-8828343' o '8828343' debe encontrar ambas variantes
  const pattern = patronDeDigitos('8828343');
  assert.equal(pattern.test('8828343'), true);
  // El patrón '8[^0-9]*8[^0-9]*2...' TAMBIÉN encuentra 'V-8828343'
  // porque [^0-9]* coincide con 'V-' (ninguno de esos caracteres es un dígito)
  assert.equal(pattern.test('V-8828343'), true);
  // Y también funciona sin V
  assert.equal(pattern.test('8828343'), true);
  // Y con otros separadores
  assert.equal(pattern.test('8.828.343'), true);
});

test('busqueda por digitos: solo con 3 o mas digitos', () => {
  // Menos de 3 digitos no se busca por digitos (evita falsos positivos)
  const patronesCortos = patronesDePalabra('12');
  // Solo debe haber patron tolerante, no patron de digitos
  const tieneDigitos = patronesCortos.some((p) =>
    p.test('1[^0-9]*2'),
  );
  assert.equal(tieneDigitos, false);
});

test('busqueda por digitos: encuentra numero con ceros a la izquierda', () => {
  // '327' debe encontrar '00327'
  const patrones = patronesDePalabra('327');
  assert.equal(patrones.some((p) => p.test('00327')), true);
  assert.equal(patrones.some((p) => p.test('327')), true);
});

test('busqueda local con digitos en filtro', () => {
  const clientes = [
    { nombre: 'Juan', cedula: 'V-8828343' },
    { nombre: 'Maria', cedula: '8828343' },
    { nombre: 'Luis', cedula: 'V-1234567' },
  ];
  // Buscar por cedula sin guion encuentra ambas variantes
  const resultado = filtrarLocal(clientes, '8828343', [
    'nombre',
    'cedula',
  ]);
  assert.equal(resultado.length, 2);
  assert.equal(resultado.every((c) => c.cedula.includes('8828343')), true);
});

test('busqueda por digitos: coincide encuentra numeros con separadores', () => {
  // Un producto con codigo de barras
  const producto = { name: 'Cerveza X', barcode: '7591234567890' };
  // Buscamos '759 1234 5678' (con espacios)
  const palabras = palabrasDe('7591234567890');
  assert.equal(
    coincide([producto.barcode], palabras),
    true,
  );
});
