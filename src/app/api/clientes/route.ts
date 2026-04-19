import { NextResponse } from 'next/server';
import { readJsonFile } from '@/lib/data';
import { Cliente } from '@/types';

// GET /api/clientes?ids=c001,c003 — Obtener clientes por IDs
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');

    const todosClientes = readJsonFile<Cliente[]>('clientes.json');

    if (idsParam) {
      const ids = idsParam.split(',');
      const filtrados = todosClientes.filter((c) => ids.includes(c.id));
      return NextResponse.json(filtrados);
    }

    // Sin filtro: devolver todos (para admin)
    return NextResponse.json(todosClientes);
  } catch {
    return NextResponse.json({ error: 'Error al leer clientes' }, { status: 500 });
  }
}
