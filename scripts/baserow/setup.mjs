#!/usr/bin/env node
/**
 * Setup de Baserow para Estancia de Oro.
 *
 * Qué hace:
 *   1. Login con user/password → JWT
 *   2. Crea las 16 tablas en la database configurada
 *   3. Por cada tabla, borra los 3 fields default ("Name", "Notes", "Active")
 *      y crea los fields definidos en schema.mjs
 *   4. Importa los datos maestros desde /data/*.json
 *   5. Al final imprime un JSON con el mapeo {tabla: id} que hay que pegar
 *      en baserow.config.ts
 *
 * Requisitos:
 *   - Variables de entorno en .env.local.baserow (o exportadas):
 *       BASEROW_URL=https://baserow.mtrpymes.com.ar
 *       BASEROW_USER=diegofainburg@mtrpymes.com.ar
 *       BASEROW_PASSWORD=xxx
 *       BASEROW_DATABASE_ID=213
 *
 * Correr:
 *   node scripts/baserow/setup.mjs
 *
 * Idempotencia:
 *   Si una tabla ya existe, la saltea (no reimporta datos). Si querés re-armar
 *   limpio, borrá las tablas en la UI antes de correr.
 */

import { readFileSync, existsSync } from 'node:fs';
import { SCHEMA } from './schema.mjs';

// -------- Config --------
const ENV_FILE = '.env.local.baserow';
if (existsSync(ENV_FILE)) {
  const lines = readFileSync(ENV_FILE, 'utf-8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const URL_BASE = process.env.BASEROW_URL || 'https://baserow.mtrpymes.com.ar';
const USER = process.env.BASEROW_USER;
const PASS = process.env.BASEROW_PASSWORD;
const DATABASE_ID = parseInt(process.env.BASEROW_DATABASE_ID || '0', 10);

if (!USER || !PASS || !DATABASE_ID) {
  console.error('Faltan BASEROW_USER / BASEROW_PASSWORD / BASEROW_DATABASE_ID en el entorno o en .env.local.baserow');
  process.exit(1);
}

// -------- HTTP helpers --------
let JWT = null;

async function http(method, path, body, { token = JWT, asToken = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = asToken ? `Token ${token}` : `JWT ${token}`;
  const res = await fetch(`${URL_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${method} ${path}: ${JSON.stringify(data).slice(0, 400)}`);
  }
  return data;
}

async function login() {
  const r = await http('POST', '/api/user/token-auth/', { email: USER, password: PASS });
  JWT = r.token;
  console.log(`✓ Login ok (${r.user?.first_name || USER})`);
}

// -------- Baserow primitives --------
async function listTables(dbId) {
  return http('GET', `/api/database/tables/database/${dbId}/`);
}

async function createTable(dbId, name) {
  return http('POST', `/api/database/tables/database/${dbId}/`, { name });
}

async function listFields(tableId) {
  return http('GET', `/api/database/fields/table/${tableId}/`);
}

async function createField(tableId, field) {
  return http('POST', `/api/database/fields/table/${tableId}/`, field);
}

async function updateField(fieldId, field) {
  return http('PATCH', `/api/database/fields/${fieldId}/`, field);
}

async function deleteField(fieldId) {
  return http('DELETE', `/api/database/fields/${fieldId}/`);
}

async function batchCreateRows(tableId, rows) {
  // Máximo 200 filas por batch en Baserow
  const chunks = [];
  for (let i = 0; i < rows.length; i += 200) chunks.push(rows.slice(i, i + 200));
  let inserted = 0;
  for (const chunk of chunks) {
    await http('POST', `/api/database/rows/table/${tableId}/batch/?user_field_names=true`, { items: chunk });
    inserted += chunk.length;
    process.stdout.write(`  → ${inserted}/${rows.length}\r`);
  }
  process.stdout.write('\n');
  return inserted;
}

// -------- Schema setup --------
async function ensureTable(dbId, tableSpec, existingByName) {
  const { name, fields } = tableSpec;
  let table = existingByName[name];
  if (!table) {
    table = await createTable(dbId, name);
    console.log(`+ Tabla "${name}" creada (id=${table.id})`);
  } else {
    console.log(`· Tabla "${name}" ya existe (id=${table.id}) — saltea creación`);
    return { table, created: false };
  }

  // Reemplazar campos default por los nuestros.
  // Baserow no deja borrar el primary field: renombramos el primero y agregamos el resto.
  const existingFields = await listFields(table.id);
  const [primary, ...rest] = existingFields;
  const [firstSpec, ...restSpec] = fields;

  await updateField(primary.id, { name: firstSpec.name, ...toFieldPayload(firstSpec) });
  for (const f of rest) await deleteField(f.id);
  for (const f of restSpec) await createField(table.id, { name: f.name, ...toFieldPayload(f) });
  console.log(`  ${fields.length} fields configurados`);
  return { table, created: true };
}

// Normaliza el spec a lo que pide la API de fields
function toFieldPayload(f) {
  const { name: _n, ...rest } = f;
  return rest;
}

// -------- Data import --------
function readJson(rel) {
  return JSON.parse(readFileSync(`data/${rel}`, 'utf-8'));
}

function importClientes() {
  return readJson('clientes.json').map(c => ({
    ext_id: c.id || '',
    numero: c.numero ?? null,
    razon_social: c.razon_social || '',
    nombre_fantasia: c.nombre_fantasia || '',
    cuit: c.cuit || '',
    direccion: c.direccion || '',
    telefono: c.telefono || '',
    localidad: c.localidad || '',
    provincia: c.provincia || '',
    condicion_pago: c.condicion_pago || '',
    dias_pago: c.dias_pago ?? null,
    saldo_cuenta_corriente: c.saldo_cuenta_corriente ?? 0,
    vendedor_id: c.vendedor_id || '',
    lista_precio_id: c.lista_precio_id || 'lp_general',
    zona: c.zona || '',
    recorrido: c.recorrido || '',
    estado_cuenta: c.estado_cuenta || null,
  }));
}

function importVendedores() {
  return readJson('vendedores.json').map(v => ({
    ext_id: v.id,
    nombre: v.nombre,
    usuario: v.usuario,
    password: v.password,
    region: v.region || '',
    lista_precio_id: v.lista_precio_id || 'lp_general',
    rol: v.rol || 'vendedor',
    activo: true,
  }));
}

function importProductos() {
  return readJson('productos.json').map(p => ({
    ext_id: p.id,
    codigo: p.codigo,
    descripcion: p.descripcion,
    unidad: p.unidad || '',
    unidades_por_caja: p.unidades_por_caja ?? null,
    peso_promedio_kg: p.peso_promedio_kg ?? null, // lo completamos después manualmente
    categoria: p.categoria || '',
    marca: p.marca || '',
    nombre_produccion: p.nombre_produccion || '',
    activo: p.activo !== false,
  }));
}

function importListasPrecio() {
  const listas = readJson('listas_precio.json');
  return listas.map(l => ({ ext_id: l.id, nombre: l.nombre }));
}

function importPrecios() {
  const out = [];
  for (const l of readJson('listas_precio.json')) {
    for (const p of (l.precios || [])) {
      out.push({
        ext_id: `${l.id}_${p.producto_id}`,
        lista_id: l.id,
        producto_id: p.producto_id,
        codigo: p.codigo || '',
        precio: p.precio ?? 0,
      });
    }
  }
  return out;
}

function importProductosMadre() {
  return readJson('produccion/productos_madre.json').map(pm => ({
    madre: pm.madre,
    hijos_json: JSON.stringify(pm.hijos || []),
    cantidad_por_tina: pm.cantidad_por_tina ?? 0,
  }));
}

const IMPORTERS = {
  clientes: importClientes,
  vendedores: importVendedores,
  productos: importProductos,
  listas_precio: importListasPrecio,
  precios: importPrecios,
  productos_madre: importProductosMadre,
  // las operativas arrancan vacías
};

// -------- Main --------
async function main() {
  await login();

  const existingTables = await listTables(DATABASE_ID);
  const byName = Object.fromEntries(existingTables.map(t => [t.name, t]));

  const tableIds = {};
  for (const spec of SCHEMA) {
    const { table, created } = await ensureTable(DATABASE_ID, spec, byName);
    tableIds[spec.name] = table.id;

    if (created && IMPORTERS[spec.name]) {
      const rows = IMPORTERS[spec.name]();
      if (rows.length > 0) {
        console.log(`  Importando ${rows.length} filas a "${spec.name}"...`);
        await batchCreateRows(table.id, rows);
      }
    }
  }

  console.log('\n=== MAPEO DE TABLAS ===');
  console.log(JSON.stringify(tableIds, null, 2));
  console.log('\nCopiá esto a src/lib/baserow.config.ts (lo uso en el próximo paso).');
}

main().catch(err => {
  console.error('\nERROR:', err.message);
  process.exit(1);
});
