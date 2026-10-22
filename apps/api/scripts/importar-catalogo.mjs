#!/usr/bin/env node
/**
 * Importa el CATÁLOGO (categorías, productos con sus fórmulas y, si se pide, los almacenes) de otra
 * base Mongo a la de esta instalación, para no empezar de cero. Idempotente: se puede repetir; solo
 * escribe en el destino con upsert por `_id` y NUNCA borra nada. En el origen solo hace lecturas.
 *
 *   node apps/api/scripts/importar-catalogo.mjs \
 *     --origen-uri mongodb://127.0.0.1:27017 --origen-base <db_origen> \
 *     --destino-uri mongodb://127.0.0.1:27017 --destino-base <db_destino> \
 *     [--excluir-categorias "Eventos,Promos"] [--categoria-de-arrastrados "Insumos"] \
 *     [--renombres renombres.json] \
 *     [--imagenes-de "images.unsplash.com"] [--con-almacenes] [--incluir-inactivos] \
 *     [--reporte reporte.json] [--dry-run]
 *
 * Qué copia:
 *   - Productos activos (salvo las categorías excluidas) y, además, todo producto que sea INGREDIENTE de
 *     alguno de ellos (recursivo), aunque esté inactivo o en una categoría excluida: así ninguna fórmula
 *     queda con un ingrediente roto. Conservan su `_id`, que es lo que enlaza las fórmulas.
 *   - Las categorías que esos productos usan (y sus padres).
 *   - Con `--con-almacenes`: la definición de los almacenes (nombre y área), SIN existencias.
 *
 * Con `--solo-ids "id1,id2"` trae solo esos productos (y sus ingredientes): sirve para sumar unos
 * pocos a un catálogo ya recortado sin volver a traer lo que se había quitado.
 *
 * Con `--ofuscar-recetas` (semilla secreta en la variable OFUSCAR_SEMILLA, nunca en el repo) las
 * fórmulas se distorsionan hacia arriba para que sirvan de estimado pero no se puedan clonar; ver
 * lib/ofuscar-recetas.mjs.
 *
 * Los ingredientes arrastrados que estén en una categoría excluida se mueven a la categoría
 * `--categoria-de-arrastrados` (por nombre), para que la categoría excluida no vuelva a colarse.
 *
 * Qué NO copia: clientes, órdenes, pagos, inventario/existencias, proveedores, usuarios, configuración.
 *
 * Qué limpia en cada producto: proveedores (`supplierIds` → vacío), existencias de los productos BASE
 * (→ 0), imágenes que no vengan de un host permitido (`--imagenes-de`), campos internos de migración y
 * quién/cuándo tocó la fórmula. Los textos pasan por `--renombres`: lista de `{ "desde": "regex",
 * "hasta": "texto", "flags": "i" }` aplicada al nombre y a la descripción. Ese archivo es el lugar para
 * quitar nombres propios del negocio de origen; no vive en el repo.
 *
 * Al final verifica que cada ingrediente y cada categoría referenciados existan en el destino.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import mongoose from 'mongoose';
import { crearOfuscador } from './lib/ofuscar-recetas.mjs';

const { values: o } = parseArgs({
  options: {
    'origen-uri': { type: 'string' },
    'origen-base': { type: 'string' },
    'destino-uri': { type: 'string' },
    'destino-base': { type: 'string' },
    'excluir-categorias': { type: 'string', default: '' },
    'categoria-de-arrastrados': { type: 'string' },
    'solo-ids': { type: 'string' },
    'palabras-de-marca': { type: 'string' },
    'ofuscar-recetas': { type: 'boolean', default: false },
    renombres: { type: 'string' },
    'imagenes-de': { type: 'string', default: '' },
    'con-almacenes': { type: 'boolean', default: false },
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

const { MongoClient } = mongoose.mongo;
const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

const excluidas = new Set(
  o['excluir-categorias'].split(',').map(norm).filter(Boolean),
);
const hostsImagen = o['imagenes-de']
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);
const renombres = o.renombres
  ? JSON.parse(readFileSync(o.renombres, 'utf8')).map((r) => ({
      re: new RegExp(r.desde, r.flags ?? 'i'),
      hasta: r.hasta ?? '',
    }))
  : [];

const renombrar = (texto) => {
  if (typeof texto !== 'string') return { texto, cambio: false };
  let t = texto;
  for (const r of renombres) t = t.replace(r.re, r.hasta);
  t = t.replace(/\s{2,}/g, ' ').trim();
  return { texto: t, cambio: t !== texto.trim() };
};

const hostDe = (url) => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
};

/** Campos que solo tienen sentido en la base de origen. */
const CAMPOS_INTERNOS = [
  '_firestoreCreatedAt',
  '_firestoreUpdatedAt',
  '__v',
  'recipeUpdatedBy',
  'recipeUpdatedAt',
  'preparedByEmployeeId',
  'preparedByName',
  'legacyCostFixedAt',
  'costUpdatedAt',
  'naturalezaPendiente',
];

const origenCli = new MongoClient(o['origen-uri'], {
  readPreference: 'secondaryPreferred',
});
const destinoCli = new MongoClient(o['destino-uri']);
await Promise.all([origenCli.connect(), destinoCli.connect()]);
const origen = origenCli.db(o['origen-base']);
const destino = destinoCli.db(o['destino-base']);

const reporte = {
  origen: o['origen-base'],
  destino: o['destino-base'],
  dryRun: o['dry-run'],
  excluidas: [...excluidas],
};

// ── 1. Selección de productos ────────────────────────────────────────────
const categoriasOrigen = await origen
  .collection('categories')
  .find({})
  .toArray();
const nombreCat = new Map(categoriasOrigen.map((c) => [String(c._id), c.name]));
const catExcluida = (id) => excluidas.has(norm(nombreCat.get(String(id))));

const todos = await origen.collection('products').find({}).toArray();
const porId = new Map(todos.map((p) => [String(p._id), p]));

const soloIds = new Set(
  (o['solo-ids'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);
const base = todos.filter((p) =>
  soloIds.size > 0
    ? soloIds.has(String(p._id))
    : (o['incluir-inactivos'] || p.isActive !== false) &&
      !catExcluida(p.categoryId),
);
const elegidos = new Map(base.map((p) => [String(p._id), p]));
reporte.porCategoriaExcluida = todos.filter(
  (p) =>
    (o['incluir-inactivos'] || p.isActive !== false) &&
    catExcluida(p.categoryId),
).length;

// Cierre por ingredientes: una fórmula con un ingrediente roto no sirve.
const arrastrados = [];
const idsArrastrados = new Set();
const pila = [...elegidos.values()];
const rotos = [];
while (pila.length) {
  const p = pila.pop();
  for (const ing of p.ingredients ?? []) {
    const id = String(ing.productId);
    if (elegidos.has(id)) continue;
    const dep = porId.get(id);
    if (!dep) {
      rotos.push({ producto: p.name, ingrediente: id });
      continue;
    }
    elegidos.set(id, dep);
    arrastrados.push(dep.name);
    idsArrastrados.add(id);
    pila.push(dep);
  }
}
reporte.arrastradosPorIngrediente = arrastrados;
reporte.ingredientesRotosEnOrigen = rotos;

// ── 2. Transformación ───────────────────────────────────────────────────
const marcasCambiadas = [];
const reubicados = [];
const nombreDestinoArrastrados = o['categoria-de-arrastrados'];
const destinoArrastrados = nombreDestinoArrastrados
  ? String(
      categoriasOrigen.find(
        (c) => norm(c.name) === norm(nombreDestinoArrastrados),
      )?._id ?? '',
    ) || undefined
  : undefined;
if (nombreDestinoArrastrados && !destinoArrastrados) {
  console.error(
    `No existe la categoría "${nombreDestinoArrastrados}" en el origen.`,
  );
  process.exit(1);
}
const imagenes = { conservadas: 0, quitadas: 0 };
const ofuscador = o['ofuscar-recetas']
  ? (() => {
      try {
        return crearOfuscador(process.env.OFUSCAR_SEMILLA ?? '');
      } catch (e) {
        console.error(
          `--ofuscar-recetas: ${e.message} (variable OFUSCAR_SEMILLA)`,
        );
        process.exit(1);
      }
    })()
  : null;
const productos = [];
for (const p of elegidos.values()) {
  const q = ofuscador ? ofuscador.producto(p) : { ...p };
  for (const k of CAMPOS_INTERNOS) delete q[k];
  if (
    destinoArrastrados &&
    idsArrastrados.has(String(p._id)) &&
    catExcluida(p.categoryId)
  ) {
    q.categoryId = destinoArrastrados;
    delete q.subcategoryId;
    reubicados.push(p.name);
  }
  q.supplierIds = [];
  if (q.type === 'BASE' || q.type === undefined) q.stock = 0;
  for (const campo of ['name', 'description']) {
    if (typeof q[campo] === 'string') {
      const { texto, cambio } = renombrar(q[campo]);
      if (cambio)
        marcasCambiadas.push({ campo, antes: q[campo], despues: texto });
      q[campo] = texto;
    }
  }
  if (typeof q.imageUrl === 'string' && q.imageUrl) {
    if (hostsImagen.includes(hostDe(q.imageUrl))) imagenes.conservadas++;
    else {
      q.imageUrl = null;
      imagenes.quitadas++;
    }
  }
  const ahora = new Date();
  q.createdAt = ahora;
  q.updatedAt = ahora;
  productos.push(q);
}
reporte.recetasOfuscadas = ofuscador
  ? productos.filter((x) => x.type === 'COMPUESTO').length
  : 0;
reporte.imagenes = imagenes;
reporte.renombrados = marcasCambiadas;
reporte.reubicadosDeCategoriaExcluida = reubicados;

// Categorías usadas (más sus padres)
const usadas = new Set();
const agregarCat = (id) => {
  if (!id || usadas.has(String(id))) return;
  usadas.add(String(id));
  const c = categoriasOrigen.find((x) => String(x._id) === String(id));
  if (c?.parentId) agregarCat(c.parentId);
};
for (const p of productos) {
  agregarCat(p.categoryId);
  agregarCat(p.subcategoryId);
}
const categorias = categoriasOrigen
  .filter((c) => usadas.has(String(c._id)))
  .map((c) => {
    const q = { ...c };
    for (const k of CAMPOS_INTERNOS) delete q[k];
    const { texto: nombre } = renombrar(q.name);
    q.name = nombre;
    q.createdAt = new Date();
    q.updatedAt = new Date();
    return q;
  });

// Almacenes (solo definición)
let almacenes = [];
if (o['con-almacenes']) {
  almacenes = (
    await origen
      .collection('warehouses')
      .find({ isActive: { $ne: false } })
      .toArray()
  ).map((w) => {
    const q = { ...w };
    for (const k of CAMPOS_INTERNOS) delete q[k];
    return q;
  });
}

// Pistas para renombres que faltan: palabras de marca que sobrevivieron en lo que se va a importar
const sospechosas = [];
// Las palabras salen de `--palabras-de-marca "marca1,marca2"`: el nombre del negocio de origen no va
// escrito aquí. Sin la opción no hay pistas.
const palabrasDeMarca = (o['palabras-de-marca'] ?? '')
  .split(',')
  .map((w) => w.trim())
  .filter(Boolean)
  .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, (c) => `\\${c}`));
const patronSospechoso = palabrasDeMarca.length
  ? new RegExp(palabrasDeMarca.join('|'), 'i')
  : { test: () => false };
for (const p of productos) {
  for (const campo of ['name', 'description']) {
    if (typeof p[campo] === 'string' && patronSospechoso.test(p[campo])) {
      sospechosas.push({ id: String(p._id), campo, texto: p[campo] });
    }
  }
}
for (const c of categorias) {
  if (patronSospechoso.test(c.name ?? ''))
    sospechosas.push({ id: String(c._id), campo: 'categoria', texto: c.name });
}
reporte.sospechosasSinRenombrar = sospechosas;

// ── 3. Resumen y escritura ───────────────────────────────────────────────
const porTipo = {};
for (const p of productos)
  porTipo[p.type ?? '(sin tipo)'] = (porTipo[p.type ?? '(sin tipo)'] ?? 0) + 1;
reporte.resumen = {
  categorias: categorias.length,
  productos: productos.length,
  porTipo,
  almacenes: almacenes.length,
};

async function upsert(coleccion, docs) {
  if (docs.length === 0) return 0;
  const res = await destino.collection(coleccion).bulkWrite(
    docs.map((d) => ({
      replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true },
    })),
    { ordered: false },
  );
  return res.upsertedCount + res.modifiedCount;
}

if (!o['dry-run']) {
  reporte.escritos = {
    categories: await upsert('categories', categorias),
    products: await upsert('products', productos),
    warehouses: await upsert('warehouses', almacenes),
  };

  // ── 4. Verificación de integridad en el destino ───────────────────────
  const idsProd = new Set(
    (await destino.collection('products').distinct('_id')).map(String),
  );
  const idsCat = new Set(
    (await destino.collection('categories').distinct('_id')).map(String),
  );
  const ingredientesRotos = [];
  const categoriasRotas = [];
  for await (const p of destino
    .collection('products')
    .find({}, { projection: { name: 1, ingredients: 1, categoryId: 1 } })) {
    for (const ing of p.ingredients ?? []) {
      if (!idsProd.has(String(ing.productId)))
        ingredientesRotos.push({
          producto: p.name,
          ingrediente: String(ing.productId),
        });
    }
    if (p.categoryId && !idsCat.has(String(p.categoryId)))
      categoriasRotas.push({
        producto: p.name,
        categoria: String(p.categoryId),
      });
  }
  reporte.verificacion = { ingredientesRotos, categoriasRotas };
}

if (o.reporte) writeFileSync(o.reporte, JSON.stringify(reporte, null, 2));

console.log(
  `${o['dry-run'] ? '[SIMULACRO] ' : ''}Catálogo ${o['origen-base']} → ${o['destino-base']}`,
);
console.log(
  `  categorías: ${categorias.length} · productos: ${productos.length} ${JSON.stringify(porTipo)} · almacenes: ${almacenes.length}`,
);
console.log(
  `  arrastrados por ser ingrediente: ${arrastrados.length} · quitados por categoría excluida: ${reporte.porCategoriaExcluida}`,
);
if (ofuscador) console.log(`  recetas ofuscadas: ${reporte.recetasOfuscadas}`);
console.log(
  `  imágenes conservadas: ${imagenes.conservadas} · quitadas: ${imagenes.quitadas} · textos renombrados: ${marcasCambiadas.length}`,
);
if (reubicados.length) {
  console.log(
    `  reubicados de una categoría excluida a "${nombreDestinoArrastrados}": ${reubicados.length}`,
  );
}
if (sospechosas.length) {
  console.log(
    `  ATENCIÓN, ${sospechosas.length} texto(s) con posible nombre propio sin renombrar:`,
  );
  for (const s of sospechosas.slice(0, 25))
    console.log(`    - [${s.campo}] ${s.texto}`);
}
if (reporte.verificacion) {
  const v = reporte.verificacion;
  console.log(
    `  verificación: ${v.ingredientesRotos.length} ingredientes rotos · ${v.categoriasRotas.length} categorías rotas`,
  );
}

await Promise.all([origenCli.close(), destinoCli.close()]);
