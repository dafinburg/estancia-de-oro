import { NextResponse } from 'next/server';
import { readProductos } from '@/lib/data';
import { invalidate } from '@/lib/cache';
import * as br from '@/lib/baserow';
import { TABLES } from '@/lib/baserow.config';
import { Producto } from '@/types';

// GET /api/productos — productos activos. ?fresh=1 invalida cache.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get('fresh') === '1') invalidate('productos');
    if (url.searchParams.get('all') === '1') {
      const all = await readProductos();
      return NextResponse.json(all);
    }
    const productos = await readProductos();
    return NextResponse.json(productos.filter((p) => p.activo), {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
    });
  } catch (e) {
    return NextResponse.json({ error: 'Error al leer productos', detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

type BRProducto = {
  id: number;
  ext_id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  unidades_por_caja: number | null;
  peso_promedio_kg: number | null;
  categoria: string;
  marca: string;
  nombre_produccion: string;
  activo: boolean;
};

function toBR(p: Partial<Producto>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.id !== undefined) out.ext_id = p.id;
  if (p.codigo !== undefined) out.codigo = p.codigo;
  if (p.descripcion !== undefined) out.descripcion = p.descripcion;
  if (p.unidad !== undefined) out.unidad = p.unidad || 'unidad';
  if (p.unidades_por_caja !== undefined) out.unidades_por_caja = p.unidades_por_caja;
  if (p.peso_promedio_kg !== undefined) out.peso_promedio_kg = p.peso_promedio_kg;
  if (p.categoria !== undefined) out.categoria = p.categoria || '';
  if (p.marca !== undefined) out.marca = p.marca || '';
  if (p.nombre_produccion !== undefined) out.nombre_produccion = p.nombre_produccion || '';
  if (p.activo !== undefined) out.activo = p.activo;
  return out;
}

// POST /api/productos — crear producto nuevo
export async function POST(req: Request) {
  if (!br.isBaserowConfigured()) {
    return NextResponse.json({ ok: false, error: 'Baserow no configurado' }, { status: 400 });
  }
  try {
    const body = (await req.json()) as Partial<Producto>;
    if (!body.codigo || !body.descripcion) {
      return NextResponse.json({ ok: false, error: 'Faltan codigo o descripcion' }, { status: 400 });
    }
    // ext_id auto si no viene
    const ext_id = body.id || `prod_${body.codigo}`;
    const payload = toBR({ ...body, id: ext_id, activo: body.activo ?? true });
    const created = await br.createRow<BRProducto>(TABLES.productos, payload);
    invalidate('productos');
    return NextResponse.json({ ok: true, id: ext_id, baserow_id: created.id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

// PATCH /api/productos — actualiza por id (ext_id)
export async function PATCH(req: Request) {
  if (!br.isBaserowConfigured()) {
    return NextResponse.json({ ok: false, error: 'Baserow no configurado' }, { status: 400 });
  }
  try {
    const body = (await req.json()) as Partial<Producto> & { id: string };
    if (!body.id) return NextResponse.json({ ok: false, error: 'Falta id' }, { status: 400 });
    const row = await br.findBy<BRProducto>(TABLES.productos, 'ext_id', body.id);
    if (!row) return NextResponse.json({ ok: false, error: 'Producto no encontrado' }, { status: 404 });
    const payload = toBR(body);
    delete payload.ext_id; // no permitimos cambiar el id
    await br.updateRow<BRProducto>(TABLES.productos, row.id, payload);
    invalidate('productos');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

// DELETE /api/productos?id=xxx — borra por ext_id
export async function DELETE(req: Request) {
  if (!br.isBaserowConfigured()) {
    return NextResponse.json({ ok: false, error: 'Baserow no configurado' }, { status: 400 });
  }
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ ok: false, error: 'Falta id' }, { status: 400 });
    const row = await br.findBy<BRProducto>(TABLES.productos, 'ext_id', id);
    if (!row) return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 });
    await br.deleteRow(TABLES.productos, row.id);
    invalidate('productos');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
