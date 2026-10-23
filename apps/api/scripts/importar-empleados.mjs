#!/usr/bin/env node
/**
 * Importa EMPLEADOS de otra base Mongo a la de esta instalación, con el sueldo en 0 (o el que se
 * pida). Idempotente: upsert por `_id`, nunca borra nada en el destino y en el origen solo lee.
 *
 *   node apps/api/scripts/importar-empleados.mjs \
 *     --origen-uri mongodb://127.0.0.1:27017 --origen-base <db_origen> \
 *     --destino-uri mongodb://127.0.0.1:27017 --destino-base <db_destino> \
 *     [--sueldo 0] [--incluir-inactivos] [--reporte reporte.json] [--dry-run]
 *
 * Qué trae: nombre, correo, teléfono, cargo, departamento, fecha de ingreso y si es mesonero.
 *
 * Qué deja fuera siempre: PIN, datos bancarios, ficha médica, contacto de emergencia, documentos,
 * foto, dirección, observaciones y los enlaces a usuario/cliente del origen (no existen en el destino).
 * Sin PIN ni usuario, el empleado figura en nómina pero todavía no puede entrar a la app.
 */
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import mongoose from 'mongoose';

const { values: o } = parseArgs({
  options: {
    'origen-uri': { type: 'string' },
    'origen-base': { type: 'string' },
    'destino-uri': { type: 'string' },
    'destino-base': { type: 'string' },
    sueldo: { type: 'string', default: '0' },
    'incluir-inactivos': { type: 'boolean', default: false },
    reporte: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
});

for (const k of ['origen-uri', 'origen-base', 'destino-uri', 'destino-base']) {
  if (!o[k]) {
    console.error(`Falta --${k}.`);
    process.exit(1);
  }
}
if (
  o['origen-uri'] === o['destino-uri'] &&
  o['origen-base'] === o['destino-base']
) {
  console.error('El origen y el destino son la misma base: nada que importar.');
  process.exit(1);
}
const sueldo = Number(o.sueldo);
if (!Number.isFinite(sueldo) || sueldo < 0) {
  console.error('--sueldo debe ser un número mayor o igual a 0.');
  process.exit(1);
}

const origen = await mongoose
  .createConnection(o['origen-uri'], { dbName: o['origen-base'] })
  .asPromise();
const destino = await mongoose
  .createConnection(o['destino-uri'], { dbName: o['destino-base'] })
  .asPromise();

const texto = (v) => (typeof v === 'string' ? v.trim() : '');

const todos = await origen.db.collection('employees').find({}).toArray();
const elegidos = todos.filter(
  (e) => o['incluir-inactivos'] || e.isActive !== false,
);

const docs = elegidos.map((e) => ({
  _id: e._id,
  firstName: texto(e.firstName),
  lastName: texto(e.lastName),
  email: texto(e.email),
  phone: texto(e.phone),
  position: texto(e.position),
  department: texto(e.department),
  hireDate: e.hireDate ?? null,
  salary: sueldo,
  isActive: e.isActive !== false,
  esMesonero: e.esMesonero === true,
  updatedAt: new Date(),
  createdAt: e.createdAt ?? new Date(),
}));

const reporte = {
  origenTotal: todos.length,
  importados: docs.length,
  fueraPorInactivos: todos.length - docs.length,
  sueldo,
  mesoneros: docs.filter((d) => d.esMesonero).length,
  dryRun: o['dry-run'],
};

if (!o['dry-run'] && docs.length > 0) {
  const r = await destino.db.collection('employees').bulkWrite(
    docs.map((d) => {
      const { createdAt, ...resto } = d;
      return {
        updateOne: {
          filter: { _id: d._id },
          update: { $set: resto, $setOnInsert: { createdAt } },
          upsert: true,
        },
      };
    }),
    { ordered: false },
  );
  reporte.insertados = r.upsertedCount;
  reporte.actualizados = r.modifiedCount;
  reporte.enDestino = await destino.db.collection('employees').countDocuments();
}

console.log(JSON.stringify(reporte, null, 2));
if (o.reporte) writeFileSync(o.reporte, JSON.stringify(reporte, null, 2));
await origen.close();
await destino.close();
