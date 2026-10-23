#!/usr/bin/env node
/**
 * Importa CLIENTES de otra base Mongo a la de esta instalación. Idempotente: upsert por `_id`, nunca
 * borra nada en el destino y en el origen solo lee.
 *
 *   node apps/api/scripts/importar-clientes.mjs \
 *     --origen-uri mongodb://127.0.0.1:27017 --origen-base <db_origen> \
 *     --destino-uri mongodb://127.0.0.1:27017 --destino-base <db_destino> \
 *     [--con-contacto] [--reporte reporte.json] [--dry-run]
 *
 * Por defecto trae solo lo que hace falta para identificar a un cliente en una orden: nombre y teléfono.
 * Con `--con-contacto` suma también correo, dirección y documento de identidad.
 *
 * Qué deja fuera siempre: crédito y cuotas de socio, número de acción, usuario enlazado, personal del
 * negocio (`isStaff`/`role`), fichas fusionadas en otra, inactivos, notas internas de migración.
 * Las cuentas por cobrar no se importan: el cliente llega sin deuda.
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
    'con-contacto': { type: 'boolean', default: false },
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

const origen = await mongoose
  .createConnection(o['origen-uri'], { dbName: o['origen-base'] })
  .asPromise();
const destino = await mongoose
  .createConnection(o['destino-uri'], { dbName: o['destino-base'] })
  .asPromise();

const filtro = {
  isActive: { $ne: false },
  isStaff: { $ne: true },
  role: { $exists: false },
  mergedIntoId: { $exists: false },
  mergedIntoCustomerId: { $exists: false },
  linkedUserId: { $exists: false },
  name: { $type: 'string', $ne: '' },
};

const texto = (v) => (typeof v === 'string' ? v.trim() : '');

const clientes = await origen.db.collection('customers').find(filtro).toArray();
const total = await origen.db.collection('customers').countDocuments();

const docs = clientes.map((c) => {
  const d = {
    _id: c._id,
    name: texto(c.name),
    phone: texto(c.phone),
    isActive: true,
    createdAt: c.createdAt ?? new Date(),
    updatedAt: new Date(),
  };
  if (o['con-contacto']) {
    d.email = texto(c.email);
    d.address = texto(c.address);
    d.identificationType = texto(c.identificationType);
    d.identificationId = texto(c.identificationId);
  }
  return d;
});

const reporte = {
  origenTotal: total,
  importables: docs.length,
  descartados: total - docs.length,
  conTelefono: docs.filter((d) => d.phone).length,
  conContacto: o['con-contacto'],
  dryRun: o['dry-run'],
};

if (!o['dry-run'] && docs.length > 0) {
  const r = await destino.db.collection('customers').bulkWrite(
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
  reporte.enDestino = await destino.db.collection('customers').countDocuments();
}

console.log(JSON.stringify(reporte, null, 2));
if (o.reporte) writeFileSync(o.reporte, JSON.stringify(reporte, null, 2));
await origen.close();
await destino.close();
