import { NextResponse } from 'next/server';
import { readPedidos, savePedido, updatePedidoEstado } from '@/lib/data';
import { Pedido } from '@/types';
import { generarNumeroPedido } from '@/lib/format';

// GET /api/pedidos?vendedor_id=v001 — Obtener pedidos (filtrados por vendedor o todos)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const vendedorId = searchParams.get('vendedor_id');
    const pedidos = await readPedidos();

    if (vendedorId) {
      return NextResponse.json(pedidos.filter((p) => p.vendedor_id === vendedorId));
    }
    return NextResponse.json(pedidos);
  } catch (err) {
    console.error('Error GET pedidos:', err);
    return NextResponse.json({ error: 'Error al leer pedidos' }, { status: 500 });
  }
}

// POST /api/pedidos — Crear un nuevo pedido
export async function POST(request: Request) {
  try {
    const nuevoPedido = await request.json() as Omit<Pedido, 'id' | 'numero' | 'created_at'>;
    const pedidos = await readPedidos();

    // Secuencia por día para el número
    const pedidosHoy = pedidos.filter((p) => p.fecha_pedido === nuevoPedido.fecha_pedido);
    const secuencia = pedidosHoy.length + 1;

    const pedidoCompleto: Pedido = {
      ...nuevoPedido,
      id: `ped_${Date.now()}`,
      numero: generarNumeroPedido(nuevoPedido.fecha_pedido, secuencia),
      created_at: new Date().toISOString(),
    };

    await savePedido(pedidoCompleto);
    return NextResponse.json({ ok: true, pedido: pedidoCompleto });
  } catch (err) {
    console.error('Error POST pedidos:', err);
    return NextResponse.json({ error: 'Error al guardar pedido' }, { status: 500 });
  }
}

// PATCH /api/pedidos — Actualizar estado de un pedido
export async function PATCH(request: Request) {
  try {
    const { id, estado } = await request.json();
    const pedido = await updatePedidoEstado(id, estado);
    if (!pedido) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, pedido });
  } catch (err) {
    console.error('Error PATCH pedidos:', err);
    return NextResponse.json({ error: 'Error al actualizar pedido' }, { status: 500 });
  }
}
