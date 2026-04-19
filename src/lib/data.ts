/**
 * Capa de persistencia de datos.
 *
 * LECTURA (vendedores, clientes, productos, listas_precio):
 *   - Siempre se leen desde los JSON en /data (son solo lectura, funcionan en Vercel)
 *
 * ESCRITURA (pedidos):
 *   - En desarrollo local: escribe al JSON /data/pedidos.json
 *   - En Vercel (filesystem read-only):
 *       a) Si hay env var GOOGLE_SHEETS_WEBHOOK_URL, envía POST al Apps Script (persistencia real)
 *       b) Siempre guarda en memoria (survive dentro de la lambda, se pierde entre cold starts)
 *
 * Lectura de pedidos:
 *   - En dev: JSON local
 *   - En Vercel: lee desde el webhook (GET) si está configurado, sino de memoria
 */
import fs from 'fs';
import path from 'path';
import { Pedido } from '@/types';

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

// Leer todos los pedidos
export async function readPedidos(): Promise<Pedido[]> {
  if (IS_VERCEL) {
    // En producción: intentar leer desde Google Sheets webhook
    if (SHEETS_WEBHOOK) {
      try {
        const res = await fetch(`${SHEETS_WEBHOOK}?action=list`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) return data.map(normalizeFromSheet);
        }
      } catch (err) {
        console.error('Error leyendo pedidos de Google Sheets:', err);
      }
    }
    // Fallback: memoria
    return globalAny.__pedidos_cache || [];
  }
  // Dev local: leer JSON
  try {
    return readJsonFile<Pedido[]>('pedidos.json');
  } catch {
    return [];
  }
}

// Guardar un nuevo pedido
export async function savePedido(pedido: Pedido): Promise<void> {
  if (IS_VERCEL) {
    // Agregar a memoria
    globalAny.__pedidos_cache = [...(globalAny.__pedidos_cache || []), pedido];
    // Enviar al webhook de Google Sheets si está configurado
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
  // Dev: escribir al JSON
  const pedidos = await readPedidos();
  pedidos.push(pedido);
  const filePath = path.join(DATA_DIR, 'pedidos.json');
  fs.writeFileSync(filePath, JSON.stringify(pedidos, null, 2), 'utf-8');
}

// Actualizar estado de un pedido existente
export async function updatePedidoEstado(id: string, estado: string): Promise<Pedido | null> {
  if (IS_VERCEL) {
    const cache = globalAny.__pedidos_cache || [];
    const idx = cache.findIndex((p) => p.id === id);
    if (idx !== -1) {
      cache[idx].estado = estado as Pedido['estado'];
    }
    if (SHEETS_WEBHOOK) {
      try {
        await fetch(SHEETS_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update_estado', id, estado }),
        });
      } catch (err) {
        console.error('Error actualizando en Google Sheets:', err);
      }
    }
    return idx !== -1 ? cache[idx] : null;
  }
  // Dev
  const pedidos = await readPedidos();
  const idx = pedidos.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  pedidos[idx].estado = estado as Pedido['estado'];
  const filePath = path.join(DATA_DIR, 'pedidos.json');
  fs.writeFileSync(filePath, JSON.stringify(pedidos, null, 2), 'utf-8');
  return pedidos[idx];
}

// Normaliza un pedido que viene del Google Sheet (con headers como claves)
// al formato interno del modelo Pedido (snake_case en español).
// Esto es necesario porque el Apps Script devuelve las claves con los nombres
// exactos del header del Sheet ("Estado", "Número", "Detalle", etc.)
function normalizeFromSheet(row: Record<string, unknown>): Pedido {
  // Si ya tiene la estructura esperada, devolver tal cual
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
    // Si viene como ISO "2026-04-19T03:00:00.000Z" devolver solo yyyy-mm-dd
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
