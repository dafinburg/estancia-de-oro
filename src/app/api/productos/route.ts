import { NextResponse } from 'next/server';
import { readProductos } from '@/lib/data';
import { invalidate } from '@/lib/cache';

// GET /api/productos — productos activos, lee Baserow en prod, JSON en dev
export async function GET(req: Request) {
  try {
    // ?fresh=1 fuerza una lectura sin cache (refrescar maestros tras un upload)
    const url = new URL(req.url);
    if (url.searchParams.get('fresh') === '1') invalidate('productos');
    const productos = await readProductos();
    return NextResponse.json(productos.filter((p) => p.activo), {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
    });
  } catch (e) {
    return NextResponse.json({ error: 'Error al leer productos', detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
