import { NextResponse } from 'next/server';
import { readClientes, updateClienteEstado } from '@/lib/data';
import { EstadoCuenta } from '@/types';

// GET /api/clientes?ids=c001,c003 — Clientes (filtrable por IDs)
// GET /api/clientes?lite=1 — version reducida (id, razon_social, vendedor_id,
//   saldo_cuenta_corriente, estado_cuenta) — ~70% mas chico, ideal para listas
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');
    const lite = searchParams.get('lite') === '1';

    const todos = await readClientes();
    let data = idsParam
      ? todos.filter((c) => idsParam.split(',').filter(Boolean).includes(c.id))
      : todos;
    if (lite) {
      data = data.map((c) => ({
        id: c.id,
        razon_social: c.razon_social,
        vendedor_id: c.vendedor_id,
        saldo_cuenta_corriente: c.saldo_cuenta_corriente,
        estado_cuenta: c.estado_cuenta,
        lista_precio_id: c.lista_precio_id,
      })) as typeof data;
    }
    return NextResponse.json(data, {
      // Clientes cambia raro (upload manual desde admin). Cache largo + SWR.
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' },
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
