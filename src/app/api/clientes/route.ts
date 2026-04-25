import { NextResponse } from 'next/server';
import { readClientes, updateClienteEstado } from '@/lib/data';
import { EstadoCuenta } from '@/types';

// GET /api/clientes?ids=c001,c003 — Clientes (filtrable por IDs)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');

    const todos = await readClientes();
    const data = idsParam
      ? todos.filter((c) => idsParam.split(',').filter(Boolean).includes(c.id))
      : todos;
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600' },
    });
  } catch (err) {
    console.error('Error en /api/clientes:', err);
    return NextResponse.json({ error: 'Error al leer clientes' }, { status: 500 });
  }
}

// PATCH /api/clientes — Actualizar estado de cuenta de un cliente
// Body: { id, estado_cuenta: 'al_dia' | 'observado' | 'bloqueado' }
export async function PATCH(request: Request) {
  try {
    const { id, estado_cuenta } = await request.json();
    if (!id || !['al_dia', 'observado', 'bloqueado'].includes(estado_cuenta)) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }
    const ok = await updateClienteEstado(id, estado_cuenta as EstadoCuenta);
    if (!ok) return NextResponse.json({ error: 'No se pudo actualizar' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error PATCH /api/clientes:', err);
    return NextResponse.json({ error: 'Error al actualizar cliente' }, { status: 500 });
  }
}
