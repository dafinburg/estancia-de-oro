/**
 * Capa de datos del módulo Producción (Elaboración / Envasado / Expedición /
 * Facturación) — replica la "PLANILLA ELABORACION OFICIAL".
 *
 * Tres modos:
 *   1. DATA_SOURCE=baserow → tablas elaboracion, envasado, expedicion,
 *      facturacion_prod (+ las _hist). Como el schema definido tiene
 *      muchas columnas que no calzan 1:1 con los tipos del front, guardamos
 *      el registro entero en `observaciones` como JSON. Eso nos da
 *      flexibilidad sin tener que migrar el schema cada vez que cambia un
 *      campo. Las columnas básicas (ext_id/fecha/estado) sí se persisten
 *      sueltas para poder filtrar/ordenar.
 *   2. VERCEL=1 + sheets webhook → habla con Apps Script.
 *   3. dev local → JSONs en /data/produccion/.
 */
import fs from 'fs';
import path from 'path';
import {
  ProductoMadre,
  ElaboracionRow,
  EnvasadoRow,
  ExpedicionRow,
  FacturacionProdRow,
  TipoPlanilla,
} from '@/types';
import { cached, invalidate } from '@/lib/cache';
import * as br from '@/lib/baserow';
import { TABLES } from '@/lib/baserow.config';

const DATA_DIR = path.join(process.cwd(), 'data', 'produccion');
const IS_VERCEL = process.env.VERCEL === '1';
const SHEETS_WEBHOOK = process.env.GOOGLE_SHEETS_WEBHOOK_URL || '';
const USE_BASEROW = (process.env.DATA_SOURCE || '').toLowerCase() === 'baserow' && br.isBaserowConfigured();

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJsonLocal<T>(file: string, fallback: T): T {
  try {
    const p = path.join(DATA_DIR, file);
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}
function writeJsonLocal<T>(file: string, data: T) {
  ensureDir();
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), 'utf-8');
}

async function getFromSheet<T>(action: string): Promise<T[] | null> {
  if (!SHEETS_WEBHOOK) return null;
  try {
    const res = await fetch(`${SHEETS_WEBHOOK}?action=${action}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data)) return data as T[];
    return null;
  } catch {
    return null;
  }
}

async function postSheet(body: Record<string, unknown>): Promise<{ ok: boolean; id?: string }> {
  if (!SHEETS_WEBHOOK) return { ok: false };
  try {
    const res = await fetch(SHEETS_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: !!data.ok, id: data.id };
  } catch {
    return { ok: false };
  }
}

function uid(): string {
  return 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// --------- PRODUCTOS MADRE ---------
export async function readProductosMadre(): Promise<ProductoMadre[]> {
  if (USE_BASEROW) {
    return cached('productos_madre', 600, async () => {
      type BRPM = { id: number; madre: string; hijos_json: string; cantidad_por_tina: number | string };
      const rows = await br.listAll<BRPM>(TABLES.productos_madre);
      return rows.map((r) => {
        let hijos: string[] = [];
        try { hijos = r.hijos_json ? JSON.parse(r.hijos_json) : []; } catch { /* ignore */ }
        const cantidad = Number(r.cantidad_por_tina) || 0;
        return { madre: r.madre || '', hijos, cantidad_por_tina: cantidad };
      });
    });
  }
  if (IS_VERCEL && SHEETS_WEBHOOK) {
    const rows = await getFromSheet<ProductoMadre>('productos_madre');
    if (rows && rows.length) return rows;
  }
  return readJsonLocal<ProductoMadre[]>('productos_madre.json', []);
}

// --------- Factory genérica para cada tipo ---------
type Mapping = {
  tipo: TipoPlanilla;
  file: string;
  fileHist: string;
  actionList: string;
  actionListHist: string;
  actionCreate: string;
  actionUpdate: string;
  actionDelete: string;
  // tabla activa + tabla histórica en Baserow
  tableActiva: number;
  tableHist: number;
  cacheKey: string;
};
const MAP: Record<TipoPlanilla, Mapping> = {
  elaboracion: {
    tipo: 'elaboracion',
    file: 'elaboracion.json',
    fileHist: 'elaboracion_historica.json',
    actionList: 'elaboraciones',
    actionListHist: 'elaboraciones_hist',
    actionCreate: 'create_elaboracion',
    actionUpdate: 'update_elaboracion',
    actionDelete: 'delete_elaboracion',
    tableActiva: TABLES.elaboracion,
    tableHist: TABLES.elaboracion_hist,
    cacheKey: 'plan_elab',
  },
  envasado: {
    tipo: 'envasado',
    file: 'envasado.json',
    fileHist: 'envasado_historico.json',
    actionList: 'envasados',
    actionListHist: 'envasados_hist',
    actionCreate: 'create_envasado',
    actionUpdate: 'update_envasado',
    actionDelete: 'delete_envasado',
    tableActiva: TABLES.envasado,
    tableHist: TABLES.envasado_hist,
    cacheKey: 'plan_env',
  },
  expedicion: {
    tipo: 'expedicion',
    file: 'expedicion.json',
    fileHist: 'expedicion_historica.json',
    actionList: 'expediciones',
    actionListHist: 'expediciones_hist',
    actionCreate: 'create_expedicion',
    actionUpdate: 'update_expedicion',
    actionDelete: 'delete_expedicion',
    tableActiva: TABLES.expedicion,
    tableHist: TABLES.expedicion_hist,
    cacheKey: 'plan_exp',
  },
  facturacion_prod: {
    tipo: 'facturacion_prod',
    file: 'facturacion_prod.json',
    fileHist: 'facturacion_prod_historica.json',
    actionList: 'facturaciones_prod',
    actionListHist: 'facturaciones_prod_hist',
    actionCreate: 'create_facturacion_prod',
    actionUpdate: 'update_facturacion_prod',
    actionDelete: 'delete_facturacion_prod',
    tableActiva: TABLES.facturacion_prod,
    tableHist: TABLES.facturacion_prod_hist,
    cacheKey: 'plan_fact',
  },
};

// ============================================================
// BASEROW: usamos un par de columnas básicas + observaciones como blob JSON
// ============================================================
type BRPlanilla = {
  id: number;
  ext_id: string;
  fecha: string;
  observaciones: string;
  estado: { value: string } | string | null;
};

function pickSelect(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null && 'value' in v) return String((v as { value: unknown }).value || '');
  return '';
}

function rowFromBR<T extends { id?: string }>(r: BRPlanilla): T {
  let blob: Record<string, unknown> = {};
  try { blob = r.observaciones ? JSON.parse(r.observaciones) : {}; } catch { blob = { observaciones: r.observaciones }; }
  // Las columnas índice ganan sobre el blob (por si quedaron desincronizadas)
  return {
    ...blob,
    id: r.ext_id || (blob.id as string) || '',
    fecha: r.fecha || (blob.fecha as string) || '',
    cerrado: pickSelect(r.estado) === 'cerrada',
  } as unknown as T;
}

function rowToBR<T extends { id?: string; fecha?: string; cerrado?: boolean }>(reg: T): Partial<BRPlanilla> {
  return {
    ext_id: reg.id || '',
    fecha: reg.fecha || null as unknown as string,
    estado: (reg.cerrado ? 'cerrada' : 'en_curso') as unknown as BRPlanilla['estado'],
    observaciones: JSON.stringify(reg),
  };
}

export async function readPlanilla<T>(tipo: TipoPlanilla, hist = false): Promise<T[]> {
  const m = MAP[tipo];
  if (USE_BASEROW) {
    const key = `${m.cacheKey}${hist ? '_h' : ''}`;
    return cached(key, 30, async () => {
      const tableId = hist ? m.tableHist : m.tableActiva;
      const rows = await br.listAll<BRPlanilla>(tableId, { orderBy: '-fecha' });
      return rows.map(rowFromBR<T & { id: string }>) as T[];
    });
  }
  const action = hist ? m.actionListHist : m.actionList;
  const file = hist ? m.fileHist : m.file;
  if (IS_VERCEL && SHEETS_WEBHOOK) {
    const rows = await getFromSheet<T>(action);
    if (rows) return rows;
  }
  return readJsonLocal<T[]>(file, []);
}

export async function createPlanillaRow<T extends { id?: string }>(
  tipo: TipoPlanilla,
  registro: T
): Promise<T> {
  if (!registro.id) registro.id = uid();
  const m = MAP[tipo];
  if (USE_BASEROW) {
    await br.createRow(m.tableActiva, rowToBR(registro as T & { id: string; fecha?: string; cerrado?: boolean }));
    invalidate(m.cacheKey);
    return registro;
  }
  if (IS_VERCEL && SHEETS_WEBHOOK) {
    await postSheet({ action: m.actionCreate, registro });
    return registro;
  }
  const rows = readJsonLocal<T[]>(m.file, []);
  rows.push(registro);
  writeJsonLocal(m.file, rows);
  return registro;
}

export async function updatePlanillaRow(
  tipo: TipoPlanilla,
  id: string,
  cambios: Record<string, unknown>
): Promise<boolean> {
  const m = MAP[tipo];
  if (USE_BASEROW) {
    const row = await br.findBy<BRPlanilla>(m.tableActiva, 'ext_id', id);
    if (!row) return false;
    const existing = rowFromBR<Record<string, unknown>>(row);
    const merged = { ...existing, ...cambios, id };
    await br.updateRow(m.tableActiva, row.id, rowToBR(merged as { id: string; fecha?: string; cerrado?: boolean }));
    invalidate(m.cacheKey);
    return true;
  }
  if (IS_VERCEL && SHEETS_WEBHOOK) {
    const r = await postSheet({ action: m.actionUpdate, id, cambios });
    return r.ok;
  }
  const rows = readJsonLocal<Record<string, unknown>[]>(m.file, []);
  const idx = rows.findIndex(r => r.id === id);
  if (idx === -1) return false;
  rows[idx] = { ...rows[idx], ...cambios };
  writeJsonLocal(m.file, rows);
  return true;
}

export async function deletePlanillaRow(tipo: TipoPlanilla, id: string): Promise<boolean> {
  const m = MAP[tipo];
  if (USE_BASEROW) {
    const row = await br.findBy<BRPlanilla>(m.tableActiva, 'ext_id', id);
    if (!row) return false;
    await br.deleteRow(m.tableActiva, row.id);
    invalidate(m.cacheKey);
    return true;
  }
  if (IS_VERCEL && SHEETS_WEBHOOK) {
    const r = await postSheet({ action: m.actionDelete, id });
    return r.ok;
  }
  const rows = readJsonLocal<Record<string, unknown>[]>(m.file, []);
  const next = rows.filter(r => r.id !== id);
  if (next.length === rows.length) return false;
  writeJsonLocal(m.file, next);
  return true;
}

export async function cerrarPlanilla(tipo: TipoPlanilla): Promise<number> {
  const m = MAP[tipo];
  if (USE_BASEROW) {
    // Mover filas con cerrado=false (estado=en_curso) a la tabla histórica
    // marcándolas como cerradas, después borrar de la activa.
    const rows = await br.listAll<BRPlanilla>(m.tableActiva);
    const porCerrar = rows.filter((r) => pickSelect(r.estado) !== 'cerrada');
    if (!porCerrar.length) return 0;
    const histPayload = porCerrar.map((r) => {
      const reg = rowFromBR<Record<string, unknown>>(r);
      return rowToBR({ ...reg, cerrado: true } as { id: string; fecha?: string; cerrado: boolean });
    });
    await br.createRows(m.tableHist, histPayload);
    // Borrar de la activa en batch
    const ids = porCerrar.map((r) => r.id);
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      await fetch(`${process.env.BASEROW_URL}/api/database/rows/table/${m.tableActiva}/batch-delete/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${process.env.BASEROW_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: chunk }),
      });
    }
    invalidate(m.cacheKey);
    invalidate(`${m.cacheKey}_h`);
    return porCerrar.length;
  }
  if (IS_VERCEL && SHEETS_WEBHOOK) {
    const res = await postSheet({ action: 'cerrar_planilla', tipo });
    return res.ok ? 1 : 0;
  }
  // Dev: mover del file activo al file histórico
  const rows = readJsonLocal<Record<string, unknown>[]>(m.file, []);
  const hist = readJsonLocal<Record<string, unknown>[]>(m.fileHist, []);
  const porCerrar = rows.filter(r => !r.cerrado);
  if (!porCerrar.length) return 0;
  const cerradas = porCerrar.map(r => ({ ...r, cerrado: true }));
  writeJsonLocal(m.fileHist, [...hist, ...cerradas]);
  writeJsonLocal(m.file, rows.filter(r => r.cerrado));
  return porCerrar.length;
}

// Helpers tipados para comodidad
export const readElaboraciones = (hist = false) => readPlanilla<ElaboracionRow>('elaboracion', hist);
export const readEnvasados = (hist = false) => readPlanilla<EnvasadoRow>('envasado', hist);
export const readExpediciones = (hist = false) => readPlanilla<ExpedicionRow>('expedicion', hist);
export const readFacturacionesProd = (hist = false) => readPlanilla<FacturacionProdRow>('facturacion_prod', hist);
