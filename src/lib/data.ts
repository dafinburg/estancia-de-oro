/**
 * Capa de persistencia de datos.
 *
 * Tres modos de operación, elegidos por env vars:
 *
 *   1. DATA_SOURCE=baserow        → lee/escribe contra Baserow (via src/lib/baserow.ts)
 *   2. VERCEL=1 (default en prod) → lee/escribe contra Google Sheets (webhook)
 *   3. dev local                  → lee/escribe JSONs en /data
 *
 * La migración a Baserow se hace activando DATA_SOURCE=baserow en Vercel preview
 * primero y luego en prod. Si falla, se vuelve al modo Sheets sacando esa var.
 */
import fs from 'fs';
import path from 'path';
import { Pedido, Cliente, Vendedor, ListaPrecio, EstadoCuenta, LineaPedido, AlertaPedido, Producto } from '@/types';
import { cached, invalidate } from '@/lib/cache';
import * as br from '@/lib/baserow';
import { TABLES } from '@/lib/baserow.config';

const DATA_DIR = path.join(process.cwd(), 'data');
const IS_VERCEL = process.env.VERCEL === '1';
const SHEETS_WEBHOOK = process.env.GOOGLE_SHEETS_WEBHOOK_URL || '';
const USE_BASEROW = (process.env.DATA_SOURCE || '').toLowerCase() === 'baserow' && br.isBaserowConfigured();

// Almacenamiento en memoria para pedidos en Vercel (fallback si no hay webhook)
const globalAny = globalThis as unknown as { __pedidos_cache?: Pedido[] };
if (!globalAny.__pedidos_cache) {
  globalAny.__pedidos_cache = [];
}

// Leer un JSON (siempre desde filesystem — funciona en dev y Vercel para datos maestros)
export function readJsonFile<T>(filename: string): T {
  const filePath = path.join(DATA_DIR, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

// ----------------- Helper genérico para GET al webhook -----------------
async function fetchFromSheet<T>(action: string, params: Record<string, string> = {}): Promise<T | null> {
  if (!SHEETS_WEBHOOK) return null;
  const qs = new URLSearchParams({ action, ...params }).toString();
  try {
    const res = await fetch(`${SHEETS_WEBHOOK}?${qs}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && typeof data === 'object' && 'error' in data) {
      console.error(`Sheet ${action} error:`, (data as { error: unknown }).error);
      return null;
    }
    return data as T;
  } catch (err) {
    console.error(`Error fetch ${action} de Sheet:`, err);
    return null;
  }
}

// ============================================================
// BASEROW — tipos de fila tal como están almacenados
// ============================================================
// Baserow reserva 'id' (es el row_id numérico interno). Nuestro id textual
// vive en ext_id. Al leer mapeamos { ...row, id: row.ext_id } para que el
// resto de la app no note la diferencia.

type BRRow = { id: number; ext_id: string; [k: string]: unknown };

type BRPedido = BRRow & {
  numero: string;
  vendedor_id: string;
  vendedor_nombre: string;
  cliente_id: string;
  cliente_razon_social: string;
  cliente_telefono: string;
  fecha_pedido: string;
  fecha_entrega: string;
  condicion_pago: string;
  direccion_entrega: string;
  transportista: string;
  telefono_transporte: string;
  direccion_transporte: string;
  lineas_json: string;
  total: number;
  estado: { value: string } | string | null;
  notas: string;
  alertas_json: string;
  precio_tipo: { value: string } | string | null;
  created_at: string;
};

type BRCliente = BRRow & {
  numero: number | null;
  razon_social: string;
  nombre_fantasia: string;
  cuit: string;
  direccion: string;
  telefono: string;
  localidad: string;
  provincia: string;
  condicion_pago: string;
  dias_pago: number | null;
  saldo_cuenta_corriente: number | string;
  vendedor_id: string;
  lista_precio_id: string;
  zona: string;
  recorrido: string;
  estado_cuenta: { value: string } | string | null;
};

type BRVendedor = BRRow & {
  nombre: string;
  usuario: string;
  password: string;
  region: string;
  lista_precio_id: string;
  rol: { value: string } | string | null;
  activo: boolean;
};

type BRListaPrecio = BRRow & { nombre: string };
type BRPrecio = BRRow & { lista_id: string; producto_id: string; codigo: string; precio: number | string };

// Un single_select en Baserow llega como { id, value, color } o null.
function pickSelect(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null && 'value' in v) return String((v as { value: unknown }).value || '');
  return '';
}

function toNumber(v: unknown, def = 0): number {
  if (v === null || v === undefined || v === '') return def;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : def;
}

// ============================================================
// ADAPTADORES: fila Baserow → tipo app
// ============================================================
function pedidoFromBR(r: BRPedido): Pedido {
  let lineas: LineaPedido[] = [];
  try { lineas = r.lineas_json ? JSON.parse(r.lineas_json) : []; } catch { lineas = []; }
  let alertas: AlertaPedido[] = [];
  try { alertas = r.alertas_json ? JSON.parse(r.alertas_json) : []; } catch { alertas = []; }

  const estadoRaw = pickSelect(r.estado).toLowerCase();
  const estadosValidos = ['pendiente', 'aprobado', 'enviado', 'en_produccion', 'entregado', 'finalizado'];
  const estado = (estadosValidos.includes(estadoRaw) ? estadoRaw : 'pendiente') as Pedido['estado'];

  return {
    id: r.ext_id,
    numero: r.numero || '',
    vendedor_id: r.vendedor_id || '',
    vendedor_nombre: r.vendedor_nombre || '',
    cliente_id: r.cliente_id || '',
    cliente_razon_social: r.cliente_razon_social || '',
    cliente_telefono: r.cliente_telefono || '',
    fecha_pedido: r.fecha_pedido || '',
    fecha_entrega: r.fecha_entrega || '',
    condicion_pago: r.condicion_pago || '',
    transportista: r.transportista || '',
    telefono_transporte: r.telefono_transporte || '',
    direccion_transporte: r.direccion_transporte || '',
    direccion_entrega: r.direccion_entrega || '',
    lineas,
    total: toNumber(r.total),
    estado,
    notas: r.notas || '',
    alertas,
    created_at: r.created_at || '',
  };
}

function pedidoToBR(p: Pedido): Record<string, unknown> {
  return {
    ext_id: p.id,
    numero: p.numero,
    vendedor_id: p.vendedor_id,
    vendedor_nombre: p.vendedor_nombre,
    cliente_id: p.cliente_id,
    cliente_razon_social: p.cliente_razon_social,
    cliente_telefono: p.cliente_telefono || '',
    fecha_pedido: p.fecha_pedido || null,
    fecha_entrega: p.fecha_entrega || null,
    condicion_pago: p.condicion_pago,
    direccion_entrega: p.direccion_entrega,
    transportista: p.transportista,
    telefono_transporte: p.telefono_transporte || '',
    direccion_transporte: p.direccion_transporte || '',
    lineas_json: JSON.stringify(p.lineas || []),
    total: p.total,
    estado: p.estado,
    notas: p.notas || '',
    alertas_json: JSON.stringify(p.alertas || []),
    created_at: p.created_at || new Date().toISOString(),
  };
}

function clienteFromBR(r: BRCliente): Cliente {
  const estado_cuenta = pickSelect(r.estado_cuenta) as EstadoCuenta;
  return {
    id: r.ext_id,
    numero: r.numero !== null && r.numero !== undefined ? Number(r.numero) : undefined,
    razon_social: r.razon_social || '',
    nombre_fantasia: r.nombre_fantasia || undefined,
    cuit: r.cuit || '',
    direccion: r.direccion || '',
    telefono: r.telefono || undefined,
    localidad: r.localidad || undefined,
    provincia: r.provincia || undefined,
    condicion_pago: r.condicion_pago || '',
    dias_pago: r.dias_pago !== null && r.dias_pago !== undefined ? Number(r.dias_pago) : undefined,
    saldo_cuenta_corriente: toNumber(r.saldo_cuenta_corriente),
    lista_precio_id: r.lista_precio_id || 'lp_general',
    vendedor_id: r.vendedor_id || undefined,
    zona: r.zona || undefined,
    recorrido: r.recorrido || undefined,
    estado_cuenta: estado_cuenta || undefined,
  };
}

function vendedorFromBR(r: BRVendedor, clientes: Cliente[]): Vendedor {
  const id = r.ext_id;
  const rol = pickSelect(r.rol);
  const clientesAsignados = rol === 'admin' || rol === 'expedicion'
    ? []
    : clientes.filter(c => c.vendedor_id === id).map(c => c.id);
  const out: Vendedor = {
    id,
    nombre: r.nombre || '',
    usuario: r.usuario || '',
    password: r.password || '',
    region: r.region || '',
    clientes: clientesAsignados,
    lista_precio_id: r.lista_precio_id || 'lp_general',
  };
  if (rol === 'admin') out.rol = 'admin';
  return out;
}

// ============================================================
// PEDIDOS
// ============================================================
export async function readPedidos(): Promise<Pedido[]> {
  if (USE_BASEROW) {
    return cached('pedidos', 60, async () => {
      const rows = await br.listAll<BRPedido>(TABLES.pedidos, { orderBy: '-created_at' });
      return rows.map(pedidoFromBR);
    });
  }
  if (IS_VERCEL) {
    return cached('pedidos', 60, async () => {
      const data = await fetchFromSheet<unknown[]>('list');
      if (!Array.isArray(data)) return globalAny.__pedidos_cache || [];
      const pedidos = (data as Record<string, unknown>[]).map(normalizeFromSheet);
      return await backfillVendedorId(pedidos);
    });
  }
  try {
    return readJsonFile<Pedido[]>('pedidos.json');
  } catch {
    return [];
  }
}

// Si algún pedido quedó sin vendedor_id (el Sheet no lo tiene), lo resolvemos
// por nombre desde el maestro de vendedores.
async function backfillVendedorId(pedidos: Pedido[]): Promise<Pedido[]> {
  const faltantes = pedidos.some(p => !p.vendedor_id && p.vendedor_nombre);
  if (!faltantes) return pedidos;
  const vendedores = await readVendedores();
  const byNombre = new Map<string, string>();
  vendedores.forEach(v => byNombre.set(v.nombre.trim().toLowerCase(), v.id));
  return pedidos.map(p => {
    if (p.vendedor_id || !p.vendedor_nombre) return p;
    const id = byNombre.get(p.vendedor_nombre.trim().toLowerCase());
    return id ? { ...p, vendedor_id: id } : p;
  });
}

export async function savePedido(pedido: Pedido): Promise<void> {
  if (USE_BASEROW) {
    await br.createRow(TABLES.pedidos, pedidoToBR(pedido));
    invalidate('pedidos');
    return;
  }
  if (IS_VERCEL) {
    globalAny.__pedidos_cache = [...(globalAny.__pedidos_cache || []), pedido];
    invalidate('pedidos');
    if (SHEETS_WEBHOOK) {
      try {
        await fetch(SHEETS_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', pedido }),
        });
      } catch (err) {
        console.error('Error enviando pedido a Google Sheets:', err);
      }
    }
    return;
  }
  const pedidos = await readPedidos();
  pedidos.push(pedido);
  const filePath = path.join(DATA_DIR, 'pedidos.json');
  fs.writeFileSync(filePath, JSON.stringify(pedidos, null, 2), 'utf-8');
}

export async function updatePedidoEstado(id: string, estado: string): Promise<Pedido | null> {
  if (USE_BASEROW) {
    const row = await br.findBy<BRPedido>(TABLES.pedidos, 'ext_id', id);
    if (!row) return null;
    const updated = await br.updateRow<BRPedido>(TABLES.pedidos, row.id, {
      estado: estado as unknown as BRPedido['estado'],
    });
    invalidate('pedidos');
    return pedidoFromBR(updated as BRPedido);
  }
  if (IS_VERCEL) {
    const cache = globalAny.__pedidos_cache || [];
    const idx = cache.findIndex((p) => p.id === id);
    if (idx !== -1) cache[idx].estado = estado as Pedido['estado'];
    invalidate('pedidos');

    if (SHEETS_WEBHOOK) {
      try {
        const res = await fetch(SHEETS_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update_estado', id, estado }),
        });
        const data = await res.json().catch(() => ({}));
        if (data && data.ok) {
          return (idx !== -1 ? cache[idx] : { id, estado } as unknown as Pedido);
        }
      } catch (err) {
        console.error('Error actualizando en Google Sheets:', err);
      }
    }
    return idx !== -1 ? cache[idx] : null;
  }
  const pedidos = await readPedidos();
  const idx = pedidos.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  pedidos[idx].estado = estado as Pedido['estado'];
  const filePath = path.join(DATA_DIR, 'pedidos.json');
  fs.writeFileSync(filePath, JSON.stringify(pedidos, null, 2), 'utf-8');
  return pedidos[idx];
}

// Editar pedido completo (desde el back-office)
export async function updatePedidoCompleto(id: string, cambios: Partial<Pedido>): Promise<Pedido | null> {
  if (USE_BASEROW) {
    const row = await br.findBy<BRPedido>(TABLES.pedidos, 'ext_id', id);
    if (!row) return null;
    // Traducir campos del tipo app → columnas Baserow
    const payload: Record<string, unknown> = {};
    if (cambios.notas !== undefined) payload.notas = cambios.notas;
    if (cambios.fecha_entrega !== undefined) payload.fecha_entrega = cambios.fecha_entrega || null;
    if (cambios.direccion_entrega !== undefined) payload.direccion_entrega = cambios.direccion_entrega;
    if (cambios.transportista !== undefined) payload.transportista = cambios.transportista;
    if (cambios.telefono_transporte !== undefined) payload.telefono_transporte = cambios.telefono_transporte;
    if (cambios.direccion_transporte !== undefined) payload.direccion_transporte = cambios.direccion_transporte;
    if (cambios.lineas !== undefined) payload.lineas_json = JSON.stringify(cambios.lineas);
    if (cambios.total !== undefined) payload.total = cambios.total;
    if (cambios.estado !== undefined) payload.estado = cambios.estado;
    if (cambios.alertas !== undefined) payload.alertas_json = JSON.stringify(cambios.alertas);
    if (cambios.condicion_pago !== undefined) payload.condicion_pago = cambios.condicion_pago;
    const updated = await br.updateRow<BRPedido>(TABLES.pedidos, row.id, payload);
    invalidate('pedidos');
    return pedidoFromBR(updated as BRPedido);
  }
  if (IS_VERCEL) {
    const cache = globalAny.__pedidos_cache || [];
    const idx = cache.findIndex((p) => p.id === id);
    if (idx !== -1) cache[idx] = { ...cache[idx], ...cambios };

    if (SHEETS_WEBHOOK) {
      try {
        const res = await fetch(SHEETS_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update_full', id, cambios }),
        });
        const data = await res.json().catch(() => ({}));
        if (data && data.ok) {
          return (idx !== -1 ? cache[idx] : { id, ...cambios } as Pedido);
        }
      } catch (err) {
        console.error('Error actualizando pedido en Sheets:', err);
      }
    }
    return idx !== -1 ? cache[idx] : null;
  }
  const pedidos = await readPedidos();
  const idx = pedidos.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  pedidos[idx] = { ...pedidos[idx], ...cambios };
  const filePath = path.join(DATA_DIR, 'pedidos.json');
  fs.writeFileSync(filePath, JSON.stringify(pedidos, null, 2), 'utf-8');
  return pedidos[idx];
}

// ============================================================
// CLIENTES
// ============================================================
export async function readClientes(): Promise<Cliente[]> {
  if (USE_BASEROW) {
    // TTL alto: el maestro de clientes cambia raro (upload de Excel). Al
    // invalidarse por escritura seguimos frescos.
    return cached('clientes', 600, async () => {
      const rows = await br.listAll<BRCliente>(TABLES.clientes, { size: 200 });
      return rows.map(clienteFromBR);
    });
  }
  if (IS_VERCEL && SHEETS_WEBHOOK) {
    return cached('clientes', 60, async () => {
      const data = await fetchFromSheet<unknown[]>('clientes');
      if (Array.isArray(data) && data.length > 0) {
        return data.map(normalizeCliente);
      }
      try {
        return readJsonFile<Cliente[]>('clientes.json');
      } catch {
        return [];
      }
    });
  }
  try {
    return readJsonFile<Cliente[]>('clientes.json');
  } catch {
    return [];
  }
}

// ============================================================
// VENDEDORES
// ============================================================
export async function readVendedores(): Promise<Vendedor[]> {
  if (USE_BASEROW) {
    return cached('vendedores', 600, async () => {
      // Paralelizar: vendedores y clientes son independientes
      const [rows, clientes] = await Promise.all([
        br.listAll<BRVendedor>(TABLES.vendedores),
        readClientes(),
      ]);
      return rows.filter(r => r.activo !== false).map(r => vendedorFromBR(r, clientes));
    });
  }
  if (IS_VERCEL && SHEETS_WEBHOOK) {
    return cached('vendedores', 60, async () => {
      const data = await fetchFromSheet<Record<string, unknown>[]>('vendedores');
      if (Array.isArray(data) && data.length > 0) {
        const clientes = await readClientes();
        return data.map((v) => normalizeVendedor(v, clientes));
      }
      try {
        return readJsonFile<Vendedor[]>('vendedores.json');
      } catch {
        return [];
      }
    });
  }
  try {
    return readJsonFile<Vendedor[]>('vendedores.json');
  } catch {
    return [];
  }
}

// ============================================================
// LISTAS DE PRECIO
// ============================================================
export async function readListasPrecio(): Promise<ListaPrecio[]> {
  if (USE_BASEROW) {
    return cached('listas_precio', 300, async () => {
      const [listas, precios] = await Promise.all([
        br.listAll<BRListaPrecio>(TABLES.listas_precio),
        br.listAll<BRPrecio>(TABLES.precios, { size: 200 }),
      ]);
      return listas.map(l => ({
        id: l.ext_id,
        nombre: l.nombre || '',
        precios: precios
          .filter(p => p.lista_id === l.ext_id)
          .map(p => ({ producto_id: p.producto_id, precio: toNumber(p.precio) })),
      }));
    });
  }
  if (IS_VERCEL && SHEETS_WEBHOOK) {
    return cached('listas_precio', 300, async () => {
      const data = await fetchFromSheet<ListaPrecio[]>('listas_precio');
      if (Array.isArray(data) && data.length > 0) return data;
      try {
        return readJsonFile<ListaPrecio[]>('listas_precio.json');
      } catch {
        return [];
      }
    });
  }
  try {
    return readJsonFile<ListaPrecio[]>('listas_precio.json');
  } catch {
    return [];
  }
}

// ============================================================
// PRODUCTOS
// ============================================================
export async function readProductos(): Promise<Producto[]> {
  if (USE_BASEROW) {
    return cached('productos', 600, async () => {
      type BRProducto = BRRow & {
        codigo: string; descripcion: string; unidad: string;
        unidades_por_caja: number | null; peso_promedio_kg: number | null;
        categoria: string; marca: string; nombre_produccion: string; activo: boolean;
      };
      const rows = await br.listAll<BRProducto>(TABLES.productos);
      return rows.map(r => ({
        id: r.ext_id,
        codigo: r.codigo || '',
        descripcion: r.descripcion || '',
        unidad: r.unidad || '',
        unidades_por_caja: r.unidades_por_caja !== null && r.unidades_por_caja !== undefined ? Number(r.unidades_por_caja) : undefined,
        peso_promedio_kg: r.peso_promedio_kg !== null && r.peso_promedio_kg !== undefined ? Number(r.peso_promedio_kg) : undefined,
        categoria: r.categoria || undefined,
        marca: r.marca || undefined,
        nombre_produccion: r.nombre_produccion || undefined,
        activo: r.activo !== false,
      }));
    });
  }
  try {
    return readJsonFile<Producto[]>('productos.json');
  } catch {
    return [];
  }
}

export async function readListaPrecio(id: string): Promise<ListaPrecio | null> {
  const listas = await readListasPrecio();
  return listas.find((l) => l.id === id) || null;
}

// Actualizar estado_cuenta de un cliente
export async function updateClienteEstado(id: string, estado_cuenta: EstadoCuenta): Promise<boolean> {
  if (USE_BASEROW) {
    const row = await br.findBy<BRCliente>(TABLES.clientes, 'ext_id', id);
    if (!row) return false;
    await br.updateRow<BRCliente>(TABLES.clientes, row.id, {
      estado_cuenta: estado_cuenta as unknown as BRCliente['estado_cuenta'],
    });
    invalidate('clientes');
    return true;
  }
  if (IS_VERCEL && SHEETS_WEBHOOK) {
    try {
      const res = await fetch(SHEETS_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_cliente_estado', id, estado_cuenta }),
      });
      const data = await res.json().catch(() => ({}));
      return !!data.ok;
    } catch (err) {
      console.error('Error update_cliente_estado:', err);
      return false;
    }
  }
  try {
    const filePath = path.join(DATA_DIR, 'clientes.json');
    const clientes = readJsonFile<Cliente[]>('clientes.json');
    const idx = clientes.findIndex(c => c.id === id);
    if (idx === -1) return false;
    clientes[idx].estado_cuenta = estado_cuenta;
    fs.writeFileSync(filePath, JSON.stringify(clientes, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// Normalizadores (modo Sheets)
// ============================================================

function normalizeFromSheet(row: Record<string, unknown>): Pedido {
  if (row.id && row.numero && row.estado) return row as unknown as Pedido;

  const pick = (...keys: string[]): unknown => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
    }
    return undefined;
  };

  const parseDate = (v: unknown): string => {
    if (!v) return '';
    const s = String(v);
    if (s.includes('T')) return s.split('T')[0];
    return s;
  };

  const parseJsonArray = (v: unknown): unknown[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    try { return JSON.parse(String(v)); } catch { return []; }
  };

  const estadoRaw = String(pick('estado', 'Estado') || 'pendiente').toLowerCase().trim();
  const estadosValidos = ['pendiente', 'aprobado', 'enviado', 'en_produccion', 'entregado', 'finalizado'];
  const estado = (estadosValidos.includes(estadoRaw) ? estadoRaw : 'pendiente') as Pedido['estado'];

  return {
    id: String(pick('id', 'ID') || ''),
    numero: String(pick('numero', 'Número', 'Numero') || ''),
    vendedor_id: String(pick('vendedor_id') || ''),
    vendedor_nombre: String(pick('vendedor_nombre', 'Vendedor') || ''),
    cliente_id: String(pick('cliente_id') || ''),
    cliente_razon_social: String(pick('cliente_razon_social', 'Cliente') || ''),
    cliente_telefono: String(pick('cliente_telefono', 'Teléfono cliente', 'Telefono cliente') || ''),
    fecha_pedido: parseDate(pick('fecha_pedido', 'Fecha pedido')),
    fecha_entrega: parseDate(pick('fecha_entrega', 'Fecha entrega')),
    condicion_pago: String(pick('condicion_pago', 'Condición pago', 'Condicion pago') || ''),
    transportista: String(pick('transportista', 'Transporte') || ''),
    telefono_transporte: String(pick('telefono_transporte', 'Tel. transporte') || ''),
    direccion_transporte: String(pick('direccion_transporte', 'Dir. transporte') || ''),
    direccion_entrega: String(pick('direccion_entrega', 'Dirección entrega', 'Direccion entrega') || ''),
    lineas: (pick('lineas') as Pedido['lineas']) || (parseJsonArray(pick('Detalle')) as Pedido['lineas']),
    total: Number(pick('total', 'Total') || 0),
    estado,
    notas: String(pick('notas', 'Notas') || ''),
    alertas: (pick('alertas') as Pedido['alertas']) || (parseJsonArray(pick('Alertas')) as Pedido['alertas']),
    created_at: String(pick('created_at', 'Created At') || ''),
  };
}

function normalizeCliente(raw: unknown): Cliente {
  const r = raw as Record<string, unknown>;
  return {
    id: String(r.id || ''),
    numero: r.numero !== undefined && r.numero !== '' ? Number(r.numero) : undefined,
    razon_social: String(r.razon_social || ''),
    nombre_fantasia: r.nombre_fantasia ? String(r.nombre_fantasia) : undefined,
    cuit: String(r.cuit || ''),
    direccion: String(r.direccion || ''),
    telefono: r.telefono ? String(r.telefono) : undefined,
    localidad: r.localidad ? String(r.localidad) : undefined,
    provincia: r.provincia ? String(r.provincia) : undefined,
    condicion_pago: String(r.condicion_pago || ''),
    dias_pago: r.dias_pago !== undefined && r.dias_pago !== '' ? Number(r.dias_pago) : undefined,
    saldo_cuenta_corriente: Number(r.saldo_cuenta_corriente) || 0,
    lista_precio_id: String(r.lista_precio_id || 'lp_general'),
    vendedor_id: r.vendedor_id ? String(r.vendedor_id) : undefined,
    zona: r.zona ? String(r.zona) : undefined,
    recorrido: r.recorrido ? String(r.recorrido) : undefined,
    estado_cuenta: r.estado_cuenta
      ? (String(r.estado_cuenta) as EstadoCuenta)
      : undefined,
  };
}

function normalizeVendedor(raw: Record<string, unknown>, clientes: Cliente[]): Vendedor {
  const id = String(raw.id || '');
  const rol = raw.rol ? (String(raw.rol) as 'admin') : undefined;
  const clientesAsignados = rol === 'admin'
    ? []
    : clientes.filter(c => c.vendedor_id === id).map(c => c.id);
  return {
    id,
    nombre: String(raw.nombre || ''),
    usuario: String(raw.usuario || ''),
    password: String(raw.password || ''),
    region: String(raw.region || ''),
    clientes: clientesAsignados,
    lista_precio_id: String(raw.lista_precio_id || 'lp_general'),
    ...(rol ? { rol } : {}),
  };
}
