import { ExpenseSchema } from './expense.schema';

/**
 * Mongoose DESCARTA EN SILENCIO lo que no esta en el esquema.
 *
 * En 1.6.0 el servicio de gastos ya mandaba `employeeId`/`employeeName`, pero
 * el esquema no los tenia: el primer prestamo real se guardo sin el vinculo al
 * empleado y ningun test lo vio, porque ninguno pasa por Mongo. Todo campo que
 * el servicio escriba tiene que estar aqui.
 */
describe('ExpenseSchema', () => {
  it.each(['employeeId', 'employeeName', 'supplierId', 'supplierName', 'description', 'ocrText'])(
    'guarda %s',
    (campo) => {
      expect(ExpenseSchema.path(campo)).toBeDefined();
    },
  );
});
