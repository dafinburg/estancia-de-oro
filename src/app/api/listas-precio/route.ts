import { NextResponse } from 'next/server';
import { readJsonFile } from '@/lib/data';
import { ListaPrecio } from '@/types';

// GET /api/listas-precio?id=lp_a — Obtener una lista de precios por ID
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    const listas = readJsonFile<ListaPrecio[]>('listas_precio.json');

    if (id) {
      const lista = listas.find((l) => l.id === id);
      if (!lista) {
        return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 });
      }
      return NextResponse.json(lista);
    }

    return NextResponse.json(listas);
  } catch {
    return NextResponse.json({ error: 'Error al leer listas de precio' }, { status: 500 });
  }
}
