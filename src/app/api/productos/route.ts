import { NextResponse } from 'next/server';
import { readProductos } from '@/lib/data';
import { invalidate } from '@/lib/cache';
import * as br from '@/lib/baserow';
import { TABLES } from '@/lib/baserow.config';

// GET /api/productos — productos activos, lee Baserow en prod, JSON en dev
export async function GET(req: Request) {
  try {
    // ?fresh=1 fuerza una lectura sin cache (para depurar / refrescar maestros)
    const url = new URL(req.url);
    if (url.searchParams.get('fresh') === '1') invalidate('productos');
    // ?env=1 devuelve estado de variables de entorno
    if (url.searchParams.get('env') === '1') {
      return NextResponse.json({
        DATA_SOURCE: process.env.DATA_SOURCE || '(unset)',
        BASEROW_URL_set: Boolean(process.env.BASEROW_URL),
        BASEROW_TOKEN_set: Boolean(process.env.BASEROW_TOKEN),
        VERCEL: process.env.VERCEL || '(unset)',
        baserow_configured: br.isBaserowConfigured(),
      });
    }
    // ?debug=1 devuelve la fila cruda de Baserow para diagnosticar
    if (url.searchParams.get('debug') === '1') {
      const rows = await br.listAll<Record<string, unknown>>(TABLES.productos, { size: 5 });
      return NextResponse.json({
        first_row: rows[0],
        keys: rows[0] ? Object.keys(rows[0]) : [],
        peso_value: rows[0]?.peso_promedio_kg,
        peso_typeof: typeof rows[0]?.peso_promedio_kg,
      });
    }
    const productos = await readProductos();
    return NextResponse.json(productos.filter((p) => p.activo), {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
    });
  } catch (e) {
    return NextResponse.json({ error: 'Error al leer productos', detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
