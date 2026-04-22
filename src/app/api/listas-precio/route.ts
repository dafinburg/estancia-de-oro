import { NextResponse } from 'next/server';
import { readListasPrecio, readListaPrecio } from '@/lib/data';

// GET /api/listas-precio?id=lp_xxx — una lista específica
// GET /api/listas-precio — todas las listas
// En producción lee del Sheet (hojas ListasPrecio + Precios), en dev del JSON.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const lista = await readListaPrecio(id);
      if (!lista) {
        return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 });
      }
      return NextResponse.json(lista);
    }

    const listas = await readListasPrecio();
    return NextResponse.json(listas);
  } catch (err) {
    console.error('Error en /api/listas-precio:', err);
    return NextResponse.json({ error: 'Error al leer listas de precio' }, { status: 500 });
  }
}
