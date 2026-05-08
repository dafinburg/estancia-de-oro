import { NextResponse } from 'next/server';
import { readPedidos, savePedido, updatePedidoEstado, updatePedidoCompleto } from '@/lib/data';
import { Pedido } from '@/types';
import { generarNumeroPedido } from '@/lib/format';

// GET /api/pedidos?vendedor_id=v001 — Obtener pedidos (filtrados por vendedor o todos)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const vendedorId = searchParams.get('vendedor_id');
    const pedidos = await readPedidos();

    // Pedidos cambia mas seguido que los maestros. SWR alto para que
    // recargas posteriores al TTL sirvan stale al instante mientras revalida.
    const headers = { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300' };
    if (vendedorId) {
      return NextResponse.json(pedidos.filter((p) => p.vendedor_id === vendedorId), { headers });
    }
    return NextResponse.json(pedidos, { headers });
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

// PATCH /api/pedidos
//   Body {id, estado}  → cambia solo el estado (flujo pendiente/aprobado/enviado)
//   Body {id, cambios} → editar campos arbitrarios del pedido desde gestión
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, estado, cambios } = body;

    let pedido;
    if (cambios) {
      pedido = await updatePedidoCompleto(id, cambios);
    } else {
      pedido = await updatePedidoEstado(id, estado);
    }

    if (!pedido) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, pedido });
  } catch (err) {
    console.error('Error PATCH pedidos:', err);
    return NextResponse.json({ error: 'Error al actualizar pedido' }, { status: 500 });
  }
}
