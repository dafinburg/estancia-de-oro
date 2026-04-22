#!/usr/bin/env node
/**
 * Seed inicial del Google Sheet — ejecutar UNA SOLA VEZ cuando se configura el Sheet.
 *
 * Uso:
 *   GOOGLE_SHEETS_WEBHOOK_URL="https://script.google.com/.../exec" node scripts/seed_sheets.mjs
 *   # o si está en .env.local, cargarlo:
 *   node --env-file=.env.local scripts/seed_sheets.mjs
 *
 * Poblará las hojas:
 *   - Clientes       (desde data/clientes.json)
 *   - Vendedores     (desde data/vendedores.json, sin el array "clientes")
 *   - ListasPrecio   (desde data/listas_precio.json)
 *   - Precios        (idem)
 *
 * Después de correrlo, el sistema en producción empieza a leer/escribir esos datos
 * desde el Sheet. Editá ahí los clientes/precios/vendedores y se reflejan en la app.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

const WEBHOOK = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
if (!WEBHOOK) {
  console.error('ERROR: falta la variable de entorno GOOGLE_SHEETS_WEBHOOK_URL');
  process.exit(1);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'));
}

async function post(action, payload) {
  const res = await fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
    redirect: 'follow',
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function main() {
  console.log('Leyendo JSONs locales…');
  const clientes = readJson('clientes.json');
  const vendedoresRaw = readJson('vendedores.json');
  const listas = readJson('listas_precio.json');

  // Aplanar vendedores (sin el array de clientes — se reconstruye vía vendedor_id)
  const vendedores = vendedoresRaw.map(v => ({
    id: v.id,
    nombre: v.nombre,
    usuario: v.usuario,
    password: v.password,
    region: v.region,
    lista_precio_id: v.lista_precio_id || 'lp_general',
    rol: v.rol || '',
  }));

  console.log(`Seed Clientes (${clientes.length})…`);
  console.log('  →', await post('seed_clientes', { clientes }));

  console.log(`Seed Vendedores (${vendedores.length})…`);
  console.log('  →', await post('seed_vendedores', { vendedores }));

  console.log(`Seed ListasPrecio (${listas.length} listas)…`);
  console.log('  →', await post('seed_listas_precio', { listas }));

  // Productos madre (catálogo para Producción/Elaboración)
  try {
    const productosMadre = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, 'produccion', 'productos_madre.json'), 'utf-8')
    );
    console.log(`Seed ProductosMadre (${productosMadre.length})…`);
    console.log('  →', await post('seed_productos_madre', { productos: productosMadre }));
  } catch (err) {
    console.log('  (productos_madre.json no encontrado, omitiendo)', err.message);
  }

  console.log('\nListo. Abrí el Google Sheet. Solapas creadas:');
  console.log('  Pedidos, Clientes, Vendedores, ListasPrecio, Precios, ProductosMadre');
  console.log('  Las solapas de Producción (Elaboracion, Envasado, Expedicion, FacturacionProd) se crean al primer registro.');
}

main().catch(err => {
  console.error('Falló el seed:', err);
  process.exit(1);
});
