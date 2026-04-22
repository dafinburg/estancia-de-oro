/**
 * Capa de persistencia de datos.
 *
 * Estrategia dual:
 *   - Dev local: lee/escribe JSONs en /data
 *   - Vercel: lee/escribe contra el Google Sheet via Apps Script (GOOGLE_SHEETS_WEBHOOK_URL)
 *
 * Lecturas que SÍ van al Sheet en producción:
 *   - pedidos     → readPedidos()
 *   - clientes    → readClientes()
 *   - vendedores  → readVendedores()
 *   - listas_precio → readListasPrecio() / readListaPrecio(id)
 *
 * Productos siguen siendo JSON (maestro pequeño y estable).
 */
import fs from 'fs';
import path from 'path';
import { Pedido, Cliente, Vendedor, ListaPrecio, EstadoCuenta } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const IS_VERCEL = process.env.VERCEL === '1';
const SHEETS_WEBHOOK = process.env.GOOGLE_SHEETS_WEBHOOK_URL || '';

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
// PEDIDOS
// ============================================================
export async function readPedidos(): Promise<Pedido[]> {
  if (IS_VERCEL) {
    const data = await fetchFromSheet<unknown[]>('list');
    if (Array.isArray(data)) return (data as Record<string, unknown>[]).map(normalizeFromSheet);
    return globalAny.__pedidos_cache || [];
  }
  try {
    return readJsonFile<Pedido[]>('pedidos.json');
  } catch {
    return [];
  }
}

export async function savePedido(pedido: Pedido): Promise<void> {
  if (IS_VERCEL) {
    globalAny.__pedidos_cache = [...(globalAny.__pedidos_cache || []), pedido];
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
  if (IS_VERCEL) {
    // Actualizar cache si existe
    const cache = globalAny.__pedidos_cache || [];
    const idx = cache.findIndex((p) => p.id === id);
    if (idx !== -1) cache[idx].estado = estado as Pedido['estado'];

    // Enviar al Sheet — esa es la fuente de verdad
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
// Permite modificar: notas, fecha_entrega, direccion_entrega, transportista, lineas, total
export async function updatePedidoCompleto(id: string, cambios: Partial<Pedido>): Promise<Pedido | null> {
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
// CLIENTES (Sheet en prod, JSON en dev)
// ============================================================
export async function readClientes(): Promise<Cliente[]> {
  if (IS_VERCEL && SHEETS_WEBHOOK) {
    const data = await fetchFromSheet<unknown[]>('clientes');
    if (Array.isArray(data) && data.length > 0) {
      return data.map(normalizeCliente);
    }
  }
  try {
    return readJsonFile<Cliente[]>('clientes.json');
  } catch {
    return [];
  }
}

// ============================================================
// VENDEDORES (Sheet en prod, JSON en dev)
// El Sheet no guarda el array de clientes (lo tiene la hoja Clientes con vendedor_id).
// Esta función reconstruye .clientes a partir del maestro de clientes.
// ============================================================
export async function readVendedores(): Promise<Vendedor[]> {
  if (IS_VERCEL && SHEETS_WEBHOOK) {
    const data = await fetchFromSheet<Record<string, unknown>[]>('vendedores');
    if (Array.isArray(data) && data.length > 0) {
      const clientes = await readClientes();
      return data.map((v) => normalizeVendedor(v, clientes));
    }
  }
  try {
    return readJsonFile<Vendedor[]>('vendedores.json');
  } catch {
    return [];
  }
}

// ============================================================
// LISTAS DE PRECIO (Sheet en prod, JSON en dev)
// ============================================================
export async function readListasPrecio(): Promise<ListaPrecio[]> {
  if (IS_VERCEL && SHEETS_WEBHOOK) {
    const data = await fetchFromSheet<ListaPrecio[]>('listas_precio');
    if (Array.isArray(data) && data.length > 0) return data;
  }
  try {
    return readJsonFile<ListaPrecio[]>('listas_precio.json');
  } catch {
    return [];
  }
}

export async function readListaPrecio(id: string): Promise<ListaPrecio | null> {
  const listas = await readListasPrecio();
  return listas.find((l) => l.id === id) || null;
}

// ============================================================
// Normalizadores
// ============================================================

// Pedido desde Sheet (headers con mayúsculas/español → snake_case interno)
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
  const estado = (['pendiente', 'aprobado', 'enviado'].includes(estadoRaw) ? estadoRaw : 'pendiente') as Pedido['estado'];

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

// Actualizar el estado de cuenta de un cliente (manual desde Cobranzas)
export async function updateClienteEstado(id: string, estado_cuenta: EstadoCuenta): Promise<boolean> {
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
  // Dev: escribir al JSON
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

function normalizeVendedor(raw: Record<string, unknown>, clientes: Cliente[]): Vendedor {
  const id = String(raw.id || '');
  const rol = raw.rol ? (String(raw.rol) as 'admin') : undefined;
  // Reconstruir lista de clientes desde el maestro (excepto admin)
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
