'use client';

import { useState, useEffect, Fragment } from 'react';
import { Pedido, EstadoPedido } from '@/types';
import { formatCurrency, formatDate } from '@/lib/format';

// Panel de administración: ver todos los pedidos, cambiar estado, ver alertas
export default function PanelAdmin() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<EstadoPedido | 'todos'>('todos');
  const [pedidoExpandido, setPedidoExpandido] = useState<string | null>(null);
  const [actualizando, setActualizando] = useState<string | null>(null);

  // Cargar todos los pedidos (sin filtro de vendedor)
  const cargarPedidos = async () => {
    try {
      const res = await fetch('/api/pedidos');
      const data = await res.json();
      setPedidos(data);
    } catch {
      console.error('Error cargando pedidos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarPedidos();
  }, []);

  // Cambiar estado de un pedido
  const cambiarEstado = async (pedidoId: string, nuevoEstado: EstadoPedido) => {
    setActualizando(pedidoId);
    try {
      const res = await fetch('/api/pedidos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pedidoId, estado: nuevoEstado }),
      });
      const data = await res.json();
      if (data.ok) {
        setPedidos((prev) =>
          prev.map((p) => (p.id === pedidoId ? { ...p, estado: nuevoEstado } : p))
        );
      }
    } catch {
      alert('Error al cambiar estado');
    } finally {
      setActualizando(null);
    }
  };

  const estadoConfig: Record<EstadoPedido, { label: string; color: string }> = {
    pendiente: { label: 'Pendiente', color: 'bg-amarillo-claro text-amber-800' },
    aprobado: { label: 'Aprobado', color: 'bg-verde-ok-claro text-verde-ok' },
    enviado: { label: 'Enviado', color: 'bg-blue-100 text-blue-800' },
  };

  // Flujo de estados posibles
  const siguienteEstado: Record<EstadoPedido, EstadoPedido | null> = {
    pendiente: 'aprobado',
    aprobado: 'enviado',
    enviado: null,
  };

  const pedidosFiltrados = filtroEstado === 'todos'
    ? pedidos
    : pedidos.filter((p) => p.estado === filtroEstado);

  const pedidosOrdenados = [...pedidosFiltrados].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Pedidos con alertas pendientes
  const pedidosConAlertas = pedidos.filter(
    (p) => p.alertas && p.alertas.length > 0 && p.estado === 'pendiente'
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-verde-oscuro border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <h2 className="text-2xl font-bold text-verde-oscuro">Panel de Administración</h2>

      {/* Resumen de estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
          <p className="text-2xl font-bold text-gray-800">{pedidos.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total pedidos</p>
        </div>
        <div className="bg-amarillo-claro rounded-xl border border-amarillo/30 p-4 text-center">
          <p className="text-2xl font-bold text-amber-800">
            {pedidos.filter((p) => p.estado === 'pendiente').length}
          </p>
          <p className="text-xs text-amber-700 mt-1">Pendientes</p>
        </div>
        <div className="bg-verde-ok-claro rounded-xl border border-verde-ok/30 p-4 text-center">
          <p className="text-2xl font-bold text-verde-ok">
            {pedidos.filter((p) => p.estado === 'aprobado').length}
          </p>
          <p className="text-xs text-green-700 mt-1">Aprobados</p>
        </div>
        <div className="bg-rojo-claro rounded-xl border border-rojo/30 p-4 text-center">
          <p className="text-2xl font-bold text-rojo">{pedidosConAlertas.length}</p>
          <p className="text-xs text-red-700 mt-1">Con alertas</p>
        </div>
      </div>

      {/* Alertas pendientes de revisión */}
      {pedidosConAlertas.length > 0 && (
        <section className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="text-lg font-semibold text-rojo mb-3">Alertas pendientes de revisión</h3>
          <div className="space-y-3">
            {pedidosConAlertas.map((pedido) => (
              <div key={pedido.id} className="border rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm text-gray-800">
                      {pedido.numero} — {pedido.cliente_razon_social}
                    </p>
                    <p className="text-xs text-gray-500">Vendedor: {pedido.vendedor_nombre}</p>
                  </div>
                </div>
                <div className="mt-2 space-y-1">
                  {pedido.alertas.map((alerta, i) => (
                    <p key={i} className={`text-xs px-2 py-1 rounded ${
                      alerta.nivel === 'error' ? 'bg-rojo-claro text-rojo' : 'bg-amarillo-claro text-amber-800'
                    }`}>
                      {alerta.nivel === 'error' ? '✗' : '⚠'} {alerta.mensaje}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filtros */}
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
          </button>
        ))}
      </div>

      {/* Tabla de pedidos */}
      {pedidosOrdenados.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <p className="text-gray-500">No hay pedidos</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="text-left px-4 py-3 font-medium">N. Pedido</th>
                  <th className="text-left px-4 py-3 font-medium">Vendedor</th>
                  <th className="text-left px-4 py-3 font-medium">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium">Entrega</th>
                  <th className="text-right px-4 py-3 font-medium">Total</th>
                  <th className="text-center px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pedidosOrdenados.map((pedido) => (
                  <Fragment key={pedido.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs font-medium text-gray-800">
                        {pedido.numero}
                        {pedido.alertas && pedido.alertas.length > 0 && (
                          <span className="ml-1 text-amarillo" title="Tiene alertas">⚠</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{pedido.vendedor_nombre}</td>
                      <td className="px-4 py-3 text-gray-800">{pedido.cliente_razon_social}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(pedido.fecha_entrega)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">{formatCurrency(pedido.total)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${estadoConfig[pedido.estado].color}`}>
                          {estadoConfig[pedido.estado].label}
                        </span>
                      </td>
                      <td className="px-4 py-3 space-x-2">
                        <button
                          onClick={() => setPedidoExpandido(
                            pedidoExpandido === pedido.id ? null : pedido.id
                          )}
                          className="text-verde-oscuro hover:underline text-xs font-medium"
                        >
                          {pedidoExpandido === pedido.id ? 'Cerrar' : 'Ver'}
                        </button>
                        {siguienteEstado[pedido.estado] && (
                          <button
                            onClick={() => cambiarEstado(pedido.id, siguienteEstado[pedido.estado]!)}
                            disabled={actualizando === pedido.id}
                            className="bg-verde-oscuro text-white px-3 py-1 rounded text-xs font-medium hover:bg-verde-claro disabled:opacity-50"
                          >
                            {actualizando === pedido.id
                              ? '...'
                              : `→ ${estadoConfig[siguienteEstado[pedido.estado]!].label}`}
                          </button>
                        )}
                      </td>
                    </tr>
                    {/* Fila expandida con detalle */}
                    {pedidoExpandido === pedido.id && (
                      <tr key={`${pedido.id}-detail`}>
                        <td colSpan={7} className="px-4 py-4 bg-gray-50">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                            <div>
                              <p className="text-gray-500">Dirección: <span className="text-gray-800">{pedido.direccion_entrega}</span></p>
                              <p className="text-gray-500">Transportista: <span className="text-gray-800">{pedido.transportista || '—'}</span></p>
                            </div>
                            {pedido.notas && (
                              <div>
                                <p className="text-gray-500">Notas:</p>
                                <p className="text-gray-800 text-xs whitespace-pre-wrap">{pedido.notas}</p>
                              </div>
                            )}
                          </div>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-500">
                                <th className="text-left py-1">Producto</th>
                                <th className="text-right py-1">Cant.</th>
                                <th className="text-right py-1">Precio</th>
                                <th className="text-right py-1">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pedido.lineas.map((l, i) => (
                                <tr key={i} className="border-t">
                                  <td className="py-1 text-gray-800">{l.codigo} — {l.descripcion}</td>
                                  <td className="py-1 text-right text-gray-800">{l.cantidad}</td>
                                  <td className="py-1 text-right text-gray-800">{formatCurrency(l.precio_unitario)}</td>
                                  <td className="py-1 text-right font-medium text-gray-800">{formatCurrency(l.subtotal)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
