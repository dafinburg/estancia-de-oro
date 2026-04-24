/**
 * Cliente HTTP para la API de Baserow.
 *
 * Estrategia:
 *   - Usamos un Database Token (no JWT) → alcanza para CRUD de filas.
 *   - Endpoints con `?user_field_names=true` para referenciar campos por
 *     nombre ("razon_social") en vez de ID interno ("field_12345").
 *   - Cliente sin dependencias: solo fetch nativo.
 *   - Los IDs de tabla se guardan en baserow.config.ts (output del script de
 *     setup).
 *
 * Variables de entorno requeridas en Vercel / dev:
 *   BASEROW_URL    → https://baserow.mtrpymes.com.ar
 *   BASEROW_TOKEN  → Database Token con permisos CRUD sobre el workspace
 */

const BASE_URL = process.env.BASEROW_URL || '';
const TOKEN = process.env.BASEROW_TOKEN || '';

export function isBaserowConfigured(): boolean {
  return Boolean(BASE_URL && TOKEN);
}

export type BaserowFilter = {
  field: string;
  type: 'equal' | 'not_equal' | 'contains' | 'empty' | 'not_empty' | 'higher_than' | 'lower_than' | 'boolean';
  value?: string | number | boolean;
};

export interface BaserowPage<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!BASE_URL || !TOKEN) {
    throw new Error('Baserow no configurado — falta BASEROW_URL o BASEROW_TOKEN');
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Token ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Baserow ${method} ${path} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  // DELETE devuelve 204 sin body
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ---------- Lecturas ----------

/**
 * Lista filas paginadas. Trae TODAS las páginas (para maestros chicos como
 * productos, vendedores, etc.). Para tablas grandes (clientes, pedidos) usar
 * filtros server-side o paginación explícita.
 */
export async function listAll<T>(tableId: number, opts: {
  filters?: BaserowFilter[];
  orderBy?: string;
  size?: number;
} = {}): Promise<T[]> {
  const size = opts.size ?? 200;
  const all: T[] = [];
  let page = 1;
  for (;;) {
    const qs = new URLSearchParams({
      user_field_names: 'true',
      size: String(size),
      page: String(page),
    });
    if (opts.orderBy) qs.set('order_by', opts.orderBy);
    for (const f of opts.filters || []) {
      if (f.value !== undefined) qs.set(`filter__${f.field}__${f.type}`, String(f.value));
      else qs.set(`filter__${f.field}__${f.type}`, '');
    }
    const data = await request<BaserowPage<T>>('GET', `/api/database/rows/table/${tableId}/?${qs}`);
    all.push(...data.results);
    if (!data.next) break;
    page++;
  }
  return all;
}

/** Una sola página (para cuando quiero paginar explícitamente en UI) */
export function listPage<T>(tableId: number, opts: {
  page?: number;
  size?: number;
  filters?: BaserowFilter[];
  orderBy?: string;
  search?: string;
} = {}): Promise<BaserowPage<T>> {
  const qs = new URLSearchParams({
    user_field_names: 'true',
    size: String(opts.size ?? 50),
    page: String(opts.page ?? 1),
  });
  if (opts.orderBy) qs.set('order_by', opts.orderBy);
  if (opts.search) qs.set('search', opts.search);
  for (const f of opts.filters || []) {
    if (f.value !== undefined) qs.set(`filter__${f.field}__${f.type}`, String(f.value));
    else qs.set(`filter__${f.field}__${f.type}`, '');
  }
  return request<BaserowPage<T>>('GET', `/api/database/rows/table/${tableId}/?${qs}`);
}

/** Busca una fila por campo (el primero que matchee) */
export async function findBy<T extends Record<string, unknown>>(
  tableId: number,
  field: string,
  value: string | number,
): Promise<T | null> {
  const r = await listPage<T>(tableId, {
    size: 1,
    filters: [{ field, type: 'equal', value }],
  });
  return r.results[0] || null;
}

/** Obtener por row_id interno de Baserow (el que sale al crear la fila) */
export function getRow<T>(tableId: number, rowId: number): Promise<T> {
  return request<T>('GET', `/api/database/rows/table/${tableId}/${rowId}/?user_field_names=true`);
}

// ---------- Escrituras ----------

export function createRow<T extends Record<string, unknown>>(
  tableId: number,
  row: Partial<T>,
): Promise<T & { id: number }> {
  return request<T & { id: number }>(
    'POST',
    `/api/database/rows/table/${tableId}/?user_field_names=true`,
    row,
  );
}

export async function createRows<T extends Record<string, unknown>>(
  tableId: number,
  rows: Partial<T>[],
): Promise<(T & { id: number })[]> {
  if (rows.length === 0) return [];
  // Batch máximo 200
  const out: (T & { id: number })[] = [];
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const r = await request<{ items: (T & { id: number })[] }>(
      'POST',
      `/api/database/rows/table/${tableId}/batch/?user_field_names=true`,
      { items: chunk },
    );
    out.push(...r.items);
  }
  return out;
}

export function updateRow<T extends Record<string, unknown>>(
  tableId: number,
  rowId: number,
  changes: Partial<T>,
): Promise<T & { id: number }> {
  return request<T & { id: number }>(
    'PATCH',
    `/api/database/rows/table/${tableId}/${rowId}/?user_field_names=true`,
    changes,
  );
}

export async function deleteRow(tableId: number, rowId: number): Promise<void> {
  await request<void>('DELETE', `/api/database/rows/table/${tableId}/${rowId}/`);
}

/**
 * Reemplazo completo de una tabla (para el upload Excel del admin).
 * 1. Lista todas las filas existentes.
 * 2. Las borra en batch.
 * 3. Inserta las nuevas.
 * Baserow tiene endpoint batch-delete con row_ids.
 */
export async function replaceAllRows<T extends Record<string, unknown>>(
  tableId: number,
  newRows: Partial<T>[],
): Promise<{ deleted: number; inserted: number }> {
  // 1. Obtener IDs actuales (solo el row_id interno, sin traer todos los campos)
  const existing = await listAll<{ id: number }>(tableId, { size: 200 });
  const ids = existing.map(r => r.id);

  // 2. Borrar en batch (endpoint acepta hasta 200 ids por batch)
  if (ids.length > 0) {
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      await request<unknown>(
        'POST',
        `/api/database/rows/table/${tableId}/batch-delete/`,
        { items: chunk },
      );
    }
  }

  // 3. Insertar
  const inserted = await createRows<T>(tableId, newRows);
  return { deleted: ids.length, inserted: inserted.length };
}
