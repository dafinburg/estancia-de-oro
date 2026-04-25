'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Pedido, EstadoPedido, Vendedor } from '@/types';
import { formatCurrency, formatDate } from '@/lib/format';

// Panel de administración: ver todos los pedidos, cambiar estado, ver alertas
export default function PanelAdmin() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<EstadoPedido | 'todos'>('todos');
  const [filtroVendedor, setFiltroVendedor] = useState<string>('todos');
  const [actualizando, setActualizando] = useState<string | null>(null);

  // Cargar todos los pedidos + vendedores (en paralelo)
  const cargarDatos = async () => {
    try {
      const [rp, rv] = await Promise.all([
        fetch('/api/pedidos'),
        fetch('/api/vendedores'),
      ]);
      setPedidos(await rp.json());
      setVendedores(await rv.json());
    } catch {
      console.error('Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
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
    en_produccion: { label: 'En producción', color: 'bg-purple-100 text-purple-800' },
    entregado: { label: 'Entregado', color: 'bg-emerald-100 text-emerald-800' },
    finalizado: { label: 'Finalizado', color: 'bg-gray-200 text-gray-700' },
  };

  // Flujo de estados posibles
  const siguienteEstado: Record<EstadoPedido, EstadoPedido | null> = {
    pendiente: 'aprobado',
    aprobado: 'enviado',
    enviado: 'en_produccion',
    en_produccion: 'entregado',
    entregado: 'finalizado',
    finalizado: null,
  };

  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter(p => {
      if (filtroEstado !== 'todos' && p.estado !== filtroEstado) return false;
      if (filtroVendedor !== 'todos' && p.vendedor_id !== filtroVendedor) return false;
      return true;
    });
  }, [pedidos, filtroEstado, filtroVendedor]);

  const pedidosOrdenados = [...pedidosFiltrados].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const vendedoresOrdenados = useMemo(
    () => [...vendedores].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [vendedores]
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-verde-oscuro">Panel de Administración</h2>
        <button
          onClick={() => window.print()}
          className="no-print bg-verde-oscuro text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-verde-claro flex items-center gap-2"
          title="Imprime los pedidos según los filtros activos"
        >
          🖨 Imprimir lista
        </button>
      </div>

      {/* Cabecera de impresión: muestra los filtros aplicados */}
      <div className="hidden print:block border-b pb-2 mb-2">
        <p className="text-sm">
          <strong>Estado:</strong> {filtroEstado === 'todos' ? 'Todos' : estadoConfig[filtroEstado].label}
          {' · '}
          <strong>Vendedor:</strong> {filtroVendedor === 'todos'
            ? 'Todos'
            : (vendedores.find(v => v.id === filtroVendedor)?.nombre || filtroVendedor)}
          {' · '}
          <strong>{pedidosOrdenados.length}</strong> pedidos
        </p>
      </div>

      {/* Resumen de estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
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
        <section className="bg-white rounded-xl shadow-sm border p-5 no-print">
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
      <div className="space-y-3 no-print">
        <div className="flex flex-wrap gap-2">
          {(['todos', 'pendiente', 'aprobado', 'enviado', 'en_produccion', 'entregado', 'finalizado'] as const).map((estado) => (
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
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-sm text-gray-600 font-medium">Vendedor:</label>
          <select
            value={filtroVendedor}
            onChange={(e) => setFiltroVendedor(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-verde-oscuro outline-none"
          >
            <option value="todos">Todos los vendedores</option>
            {vendedoresOrdenados
              .filter(v => !v.rol || v.rol === undefined) // sólo vendedores, no admin/expedicion
              .map(v => (
                <option key={v.id} value={v.id}>{v.nombre}</option>
              ))}
          </select>
          {filtroVendedor !== 'todos' && (
            <button onClick={() => setFiltroVendedor('todos')} className="text-xs text-gray-500 hover:text-gray-700 underline">
              limpiar
            </button>
          )}
        </div>
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
                  <th className="px-4 py-3 font-medium no-print">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pedidosOrdenados.map((pedido) => (
                  <tr key={pedido.id} className="hover:bg-gray-50">
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
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${(estadoConfig[pedido.estado] || estadoConfig.pendiente).color}`}>
                        {(estadoConfig[pedido.estado] || estadoConfig.pendiente).label}
                      </span>
                    </td>
                    <td className="px-4 py-3 space-x-2 whitespace-nowrap no-print">
                      <Link
                        href={`/gestion/pedidos/${pedido.id}`}
                        className="text-verde-oscuro hover:underline text-xs font-medium"
                      >
                        Ver / Editar
                      </Link>
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
