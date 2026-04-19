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
          if (Array.isArray(data)) return data as Pedido[];
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
