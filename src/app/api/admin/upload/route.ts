/**
 * API de upload masivo con REEMPLAZO TOTAL.
 *
 * POST /api/admin/upload
 *   multipart/form-data:
 *     file    → xlsx o csv
 *     entity  → 'clientes' | 'productos' | 'lista_precio'
 *     lista_id?  → requerido si entity=lista_precio (ej 'lp_general')
 *
 * Lee la planilla, la normaliza a las columnas esperadas por Baserow y
 * reemplaza el contenido de la tabla correspondiente.
 *
 * Requiere Baserow configurado (DATA_SOURCE=baserow). No funciona contra
 * Sheets/JSON — es una operación destructiva y queremos sólo un único
 * backend autoritativo cuando se usa.
 */
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import * as br from '@/lib/baserow';
import { TABLES } from '@/lib/baserow.config';
import { invalidate } from '@/lib/cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Row = Record<string, unknown>;

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
// Lookup insensible a mayúsculas/acentos/espacios para columnas de la planilla
function pick(row: Row, ...keys: string[]): unknown {
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const table: Record<string, unknown> = {};
  for (const k of Object.keys(row)) table[norm(k)] = row[k];
  for (const k of keys) {
    const v = table[norm(k)];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

function parseSheet(buf: ArrayBuffer): Row[] {
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Row>(sheet, { defval: '' });
}

// ------- mappers por entidad -------
function mapClientes(rows: Row[]): Row[] {
  return rows
    .map((r) => {
      const razon = str(pick(r, 'razon_social', 'razón_social', 'razon social', 'cliente', 'nombre'));
      if (!razon) return null;
      const ext_id =
        str(pick(r, 'id', 'ext_id', 'codigo', 'código')) ||
        `cli_${str(pick(r, 'numero', 'n', 'nro')) || razon.slice(0, 8).replace(/\s/g, '').toLowerCase()}`;
      return {
        ext_id,
        numero: num(pick(r, 'numero', 'nro', 'n')),
        razon_social: razon,
        nombre_fantasia: str(pick(r, 'nombre_fantasia', 'fantasia', 'fantasía')),
        cuit: str(pick(r, 'cuit')),
        direccion: str(pick(r, 'direccion', 'dirección', 'domicilio')),
        telefono: str(pick(r, 'telefono', 'teléfono', 'tel')),
        localidad: str(pick(r, 'localidad')),
        provincia: str(pick(r, 'provincia')),
        condicion_pago: str(pick(r, 'condicion_pago', 'condición_pago', 'condicion pago', 'cond_pago')),
        dias_pago: num(pick(r, 'dias_pago', 'días_pago', 'dias pago')),
        saldo_cuenta_corriente: num(pick(r, 'saldo_cuenta_corriente', 'saldo', 'saldo_cc')) ?? 0,
        vendedor_id: str(pick(r, 'vendedor_id', 'vendedor')),
        lista_precio_id: str(pick(r, 'lista_precio_id', 'lista_precio', 'lista')) || 'lp_general',
        zona: str(pick(r, 'zona')),
        recorrido: str(pick(r, 'recorrido')),
        estado_cuenta: str(pick(r, 'estado_cuenta', 'estado')).toLowerCase() || null,
      };
    })
    .filter((x) => x !== null) as Row[];
}

function mapProductos(rows: Row[]): Row[] {
  return rows
    .map((r) => {
      const codigo = str(pick(r, 'codigo', 'código', 'cod'));
      const descripcion = str(pick(r, 'descripcion', 'descripción', 'producto', 'nombre'));
      if (!codigo && !descripcion) return null;
      const ext_id = str(pick(r, 'id', 'ext_id')) || `prod_${codigo || descripcion.slice(0, 8)}`.toLowerCase().replace(/\s/g, '');
      return {
        ext_id,
        codigo,
        descripcion,
        unidad: str(pick(r, 'unidad', 'um')),
        unidades_por_caja: num(pick(r, 'unidades_por_caja', 'upc', 'un_caja', 'u/caja')),
        peso_promedio_kg: num(pick(r, 'peso_promedio_kg', 'peso_promedio', 'peso_kg', 'kg')),
        categoria: str(pick(r, 'categoria', 'categoría')),
        marca: str(pick(r, 'marca')),
        nombre_produccion: str(pick(r, 'nombre_produccion', 'nombre_producción', 'nombre_prod')),
        activo: str(pick(r, 'activo')).toLowerCase() !== 'no' && str(pick(r, 'activo')).toLowerCase() !== 'false',
      };
    })
    .filter((x) => x !== null) as Row[];
}

function mapPrecios(rows: Row[], lista_id: string): Row[] {
  return rows
    .map((r) => {
      const codigo = str(pick(r, 'codigo', 'código', 'cod'));
      const producto_id = str(pick(r, 'producto_id', 'id')) || `prod_${codigo.toLowerCase()}`;
      const precio = num(pick(r, 'precio', 'precio_kg', 'precio_unitario'));
      if (!codigo && !producto_id) return null;
      if (precio === null) return null;
      return {
        ext_id: `${lista_id}__${producto_id}`,
        lista_id,
        producto_id,
        codigo,
        precio,
      };
    })
    .filter((x) => x !== null) as Row[];
}

export async function POST(req: NextRequest) {
  if (!br.isBaserowConfigured()) {
    return NextResponse.json({ ok: false, error: 'Baserow no configurado. Upload masivo requiere DATA_SOURCE=baserow.' }, { status: 400 });
  }
  const form = await req.formData();
  const file = form.get('file');
  const entity = str(form.get('entity'));
  const lista_id = str(form.get('lista_id'));

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'Falta el archivo' }, { status: 400 });
  }
  if (!['clientes', 'productos', 'lista_precio'].includes(entity)) {
    return NextResponse.json({ ok: false, error: 'entity inválido' }, { status: 400 });
  }

  try {
    const buf = await file.arrayBuffer();
    const raw = parseSheet(buf);
    if (raw.length === 0) {
      return NextResponse.json({ ok: false, error: 'La planilla está vacía' }, { status: 400 });
    }

    if (entity === 'clientes') {
      const mapped = mapClientes(raw);
      const r = await br.replaceAllRows(TABLES.clientes, mapped);
      invalidate('clientes');
      return NextResponse.json({ ok: true, entity, leidos: raw.length, ...r });
    }
    if (entity === 'productos') {
      const mapped = mapProductos(raw);
      const r = await br.replaceAllRows(TABLES.productos, mapped);
      invalidate('productos');
      return NextResponse.json({ ok: true, entity, leidos: raw.length, ...r });
    }
    if (entity === 'lista_precio') {
      if (!lista_id) {
        return NextResponse.json({ ok: false, error: 'Falta lista_id (ej lp_general)' }, { status: 400 });
      }
      const mapped = mapPrecios(raw, lista_id);
      // Reemplazo parcial: sólo los precios de ESTA lista, no tocamos otras listas
      const existentes = await br.listAll<{ id: number; lista_id: string }>(TABLES.precios, { size: 200 });
      const delIds = existentes.filter((p) => p.lista_id === lista_id).map((p) => p.id);
      if (delIds.length > 0) {
        for (let i = 0; i < delIds.length; i += 200) {
          const chunk = delIds.slice(i, i + 200);
          await fetch(`${process.env.BASEROW_URL}/api/database/rows/table/${TABLES.precios}/batch-delete/`, {
            method: 'POST',
            headers: {
              'Authorization': `Token ${process.env.BASEROW_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ items: chunk }),
          });
        }
      }
      const inserted = await br.createRows(TABLES.precios, mapped);
      invalidate('listas_precio');
      return NextResponse.json({ ok: true, entity, leidos: raw.length, deleted: delIds.length, inserted: inserted.length });
    }
    return NextResponse.json({ ok: false, error: 'No implementado' }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    console.error('Upload error:', err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
