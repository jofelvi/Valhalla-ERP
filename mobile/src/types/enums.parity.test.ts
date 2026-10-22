/**
 * Test de paridad de enums entre mobile/src/types/enums.ts y @odin6/types.
 * Verifica que los valores críticos para el negocio estén sincronizados.
 *
 * Nota: mobile/src/types/enums.ts es una copia manual porque el build de APK
 * usa --ignore-workspace y no puede importar paquetes del workspace.
 *
 * Este test verifica el contenido textual del archivo de enums ya que
 * --experimental-strip-types no soporta TypeScript enums.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const enumsFilePath = path.join(__dirname, 'enums.ts');
const enumsContent = fs.readFileSync(enumsFilePath, 'utf-8');

test('UserRoleEnum: todos los roles están presentes en el archivo', () => {
  const expectedRoles = [
    "ADMIN = 'admin'",
    "MANAGER = 'manager'",
    "CASHIER = 'cashier'",
    "WAITER = 'waiter'",
    "KITCHEN = 'kitchen'",
    "BAR = 'bar'",
    "PIZZA = 'pizza'",
    "CUSTOMER = 'customer'",
  ];

  for (const role of expectedRoles) {
    assert.ok(enumsContent.includes(role), `UserRoleEnum falta: ${role}`);
  }
});

test('OrderStatusEnum: todos los estados están presentes en el archivo', () => {
  const expectedStatuses = [
    "PENDING = 'PENDING'",
    "IN_PROGRESS = 'IN_PROGRESS'",
    "READY = 'READY'",
    "DELIVERED = 'DELIVERED'",
    "CREDIT = 'CREDIT'",
    "CANCELLED = 'CANCELLED'",
    "PAID = 'PAID'",
  ];

  for (const status of expectedStatuses) {
    assert.ok(
      enumsContent.includes(status),
      `OrderStatusEnum falta: ${status}`,
    );
  }
});

test('PaymentStatusEnum: todos los estados están presentes en el archivo', () => {
  const expectedStatuses = [
    "PENDING = 'pending'",
    "PENDING_VERIFICATION = 'pending_verification'",
    "PARTIAL = 'partial'",
    "PAID = 'paid'",
    "REFUNDED = 'refunded'",
    "CANCELLED = 'cancelled'",
  ];

  for (const status of expectedStatuses) {
    assert.ok(
      enumsContent.includes(status),
      `PaymentStatusEnum falta: ${status}`,
    );
  }
});

test('PaymentMethodEnum: todos los métodos están presentes en el archivo', () => {
  const expectedMethods = [
    "CASH_BS = 'CASH_BS'",
    "CASH_USD = 'CASH_USD'",
    "CARD = 'CARD'",
    "TRANSFER = 'TRANSFER'",
    "PAGO_MOVIL = 'PAGO_MOVIL'",
    "MIXED = 'MIXED'",
    "PENDING = 'PENDING'",
  ];

  for (const method of expectedMethods) {
    assert.ok(
      enumsContent.includes(method),
      `PaymentMethodEnum falta: ${method}`,
    );
  }
});

test('ProductTypeEnum: todos los tipos están presentes en el archivo', () => {
  const expectedTypes = [
    "BASE = 'BASE'",
    "MIXED = 'COMPUESTO'",
    "SERVICE = 'SERVICIO'",
  ];

  for (const type of expectedTypes) {
    assert.ok(enumsContent.includes(type), `ProductTypeEnum falta: ${type}`);
  }
});

test('PRODUCT_TYPE_LABEL: todas las etiquetas están presentes en el archivo', () => {
  assert.ok(
    enumsContent.includes("[ProductTypeEnum.BASE]: 'Insumo'"),
    'PRODUCT_TYPE_LABEL falta etiqueta para BASE',
  );
  assert.ok(
    enumsContent.includes("[ProductTypeEnum.MIXED]: 'Preparado'"),
    'PRODUCT_TYPE_LABEL falta etiqueta para MIXED',
  );
  assert.ok(
    enumsContent.includes("[ProductTypeEnum.SERVICE]: 'Servicio'"),
    'PRODUCT_TYPE_LABEL falta etiqueta para SERVICE',
  );
});
