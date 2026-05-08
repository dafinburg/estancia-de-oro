import { NextResponse } from 'next/server';
import { readListasPrecio, readListaPrecio } from '@/lib/data';

// GET /api/listas-precio?id=lp_xxx — una lista específica
// GET /api/listas-precio — todas las listas
// En producción lee del Sheet (hojas ListasPrecio + Precios), en dev del JSON.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    const headers = { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' };
    if (id) {
      const lista = await readListaPrecio(id);
      if (!lista) {
        return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 });
      }
      return NextResponse.json(lista, { headers });
    }

    const listas = await readListasPrecio();
    return NextResponse.json(listas, { headers });
  } catch (err) {
    console.error('Error en /api/listas-precio:', err);
    return NextResponse.json({ error: 'Error al leer listas de precio' }, { status: 500 });
  }
}
