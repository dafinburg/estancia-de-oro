import { NextResponse } from 'next/server';
import { readProductos } from '@/lib/data';

// GET /api/productos — productos activos, lee Baserow en prod, JSON en dev
export async function GET() {
  try {
    const productos = await readProductos();
    return NextResponse.json(productos.filter((p) => p.activo), {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
    });
  } catch {
    return NextResponse.json({ error: 'Error al leer productos' }, { status: 500 });
  }
}
