'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Pedido, EstadoPedido } from '@/types';
import { formatCurrency, formatDate } from '@/lib/format';
import Link from 'next/link';

// Componente de listado de pedidos del vendedor logueado
// Permite filtrar por estado y ver detalle de cada pedido
export default function ListadoPedidos({ basePath = '/pedidos' }: { basePath?: string }) {
  const { vendedor } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<EstadoPedido | 'todos'>('todos');

  useEffect(() => {
    if (!vendedor) return;
    const cargar = async () => {
      try {
        const res = await fetch(`/api/pedidos?vendedor_id=${vendedor.id}`);
        const data = await res.json();
        setPedidos(data);
      } catch {
        console.error('Error cargando pedidos');
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [vendedor]);

  const pedidosFiltrados = filtroEstado === 'todos'
    ? pedidos
    : pedidos.filter((p) => p.estado === filtroEstado);

  // Ordenar por fecha más reciente primero
  const pedidosOrdenados = [...pedidosFiltrados].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const estadoConfig: Record<EstadoPedido, { label: string; color: string }> = {
    pendiente: { label: 'Pendiente', color: 'bg-amarillo-claro text-amber-800' },
    aprobado: { label: 'Aprobado', color: 'bg-verde-ok-claro text-verde-ok' },
    enviado: { label: 'Enviado', color: 'bg-blue-100 text-blue-800' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-verde-oscuro border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-verde-oscuro">Mis Pedidos</h2>
        <Link
          href="/vendedor/nuevo"
          className="bg-verde-oscuro text-white px-4 py-2 rounded-lg font-medium hover:bg-verde-claro transition-colors text-sm"
        >
          + Nuevo Pedido
        </Link>
      </div>

      {/* Filtros por estado */}
      <div className="flex flex-wrap gap-2">
        {(['todos', 'pendiente', 'aprobado', 'enviado'] as const).map((estado) => (
          <button
            key={estado}
            onClick={() => setFiltroEstado(estado)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filtroEstado === estado
                ? 'bg-verde-oscuro text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {estado === 'todos' ? 'Todos' : estadoConfig[estado].label}
            {estado === 'todos'
              ? ` (${pedidos.length})`
              : ` (${pedidos.filter((p) => p.estado === estado).length})`}
          </button>
        ))}
      </div>

      {/* Tabla de pedidos */}
      {pedidosOrdenados.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <p className="text-gray-500 text-lg">No hay pedidos{filtroEstado !== 'todos' ? ` con estado "${filtroEstado}"` : ''}</p>
          <Link href="/vendedor/nuevo" className="text-verde-oscuro font-medium hover:underline mt-2 inline-block">
            Crear primer pedido
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="text-left px-4 py-3 font-medium">N. Pedido</th>
                  <th className="text-left px-4 py-3 font-medium">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium">Fecha entrega</th>
                  <th className="text-right px-4 py-3 font-medium">Total</th>
                  <th className="text-center px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pedidosOrdenados.map((pedido) => (
                  <tr key={pedido.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-gray-800">{pedido.numero}</td>
                    <td className="px-4 py-3 text-gray-800">{pedido.cliente_razon_social}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(pedido.fecha_entrega)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">{formatCurrency(pedido.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${(estadoConfig[pedido.estado] || estadoConfig.pendiente).color}`}>
                        {(estadoConfig[pedido.estado] || estadoConfig.pendiente).label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`${basePath}/${pedido.id}`}
                        className="text-verde-oscuro hover:underline text-sm font-medium"
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
