/**
 * Capa de datos del módulo Producción (Elaboración / Envasado / Expedición /
 * Facturación) — replica la "PLANILLA ELABORACION OFICIAL".
 *
 * En Vercel → habla con Google Sheets via Apps Script.
 * En dev local → lee/escribe JSONs en /data/produccion/.
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

const DATA_DIR = path.join(process.cwd(), 'data', 'produccion');
const IS_VERCEL = process.env.VERCEL === '1';
const SHEETS_WEBHOOK = process.env.GOOGLE_SHEETS_WEBHOOK_URL || '';

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
  },
};

export async function readPlanilla<T>(tipo: TipoPlanilla, hist = false): Promise<T[]> {
  const m = MAP[tipo];
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
