'use client';

import { useState, useEffect } from 'react';
import { Pedido, Cliente } from '@/types';
import { formatCurrency, formatDate } from '@/lib/format';
import Link from 'next/link';

// Dashboard principal del back-office: métricas de alto nivel
export default function DashboardGestion() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [rp, rc] = await Promise.all([
          fetch('/api/pedidos'),
          fetch('/api/clientes'),
        ]);
        setPedidos(await rp.json());
        setClientes(await rc.json());
      } catch {
        console.error('Error cargando dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-verde-oscuro border-t-transparent rounded-full" />
      </div>
    );
  }

  // Métricas
  const pedidosPendientes = pedidos.filter(p => p.estado === 'pendiente');
  const pedidosAprobados = pedidos.filter(p => p.estado === 'aprobado');
  const pedidosEnviados = pedidos.filter(p => p.estado === 'enviado');
  const totalVentas = pedidos.reduce((s, p) => s + (p.total || 0), 0);
  const totalAFacturar = pedidosPendientes.concat(pedidosAprobados).reduce((s, p) => s + (p.total || 0), 0);

  const clientesConDeuda = clientes.filter(c => c.saldo_cuenta_corriente < 0);
  const deudaTotal = clientesConDeuda.reduce((s, c) => s + Math.abs(c.saldo_cuenta_corriente), 0);
  const clientesBloqueados = clientes.filter(c => c.saldo_cuenta_corriente < -50000);

  const pedidosConAlertas = pedidos.filter(p => p.alertas && p.alertas.length > 0);

  // Pedidos últimos 5
  const ultimosPedidos = [...pedidos]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-verde-oscuro">Dashboard</h1>
        <p className="text-gray-500 text-sm">Vista general del sistema</p>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Pedidos totales" value={pedidos.length.toString()} color="bg-white" />
        <KpiCard label="Pendientes" value={pedidosPendientes.length.toString()} color="bg-amarillo-claro text-amber-800" />
        <KpiCard label="Aprobados" value={pedidosAprobados.length.toString()} color="bg-verde-ok-claro text-verde-ok" />
        <KpiCard label="Enviados" value={pedidosEnviados.length.toString()} color="bg-blue-50 text-blue-800" />
        <KpiCard label="Facturación total" value={formatCurrency(totalVentas)} color="bg-white" small />
        <KpiCard label="A facturar (pendiente + aprobado)" value={formatCurrency(totalAFacturar)} color="bg-white" small />
        <KpiCard label="Clientes con deuda" value={`${clientesConDeuda.length} / ${clientes.length}`} color="bg-white" />
        <KpiCard label="Deuda total" value={formatCurrency(deudaTotal)} color="bg-rojo-claro text-rojo" small />
      </div>

      {/* Alertas y pendientes de acción */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">Pedidos con alertas</h3>
            <Link href="/gestion/pedidos" className="text-xs text-verde-oscuro hover:underline">Ver todos</Link>
          </div>
          {pedidosConAlertas.length === 0 ? (
            <p className="text-gray-500 text-sm">Sin alertas pendientes</p>
          ) : (
            <div className="space-y-2">
              {pedidosConAlertas.slice(0, 5).map(p => (
                <div key={p.id} className="border rounded p-2 text-sm">
                  <div className="font-medium text-gray-800">{p.numero} — {p.cliente_razon_social}</div>
                  <div className="text-xs text-gray-500">Vendedor: {p.vendedor_nombre}</div>
                  {p.alertas.map((a, i) => (
                    <div key={i} className={`text-xs mt-1 px-2 py-1 rounded inline-block ${
                      a.nivel === 'error' ? 'bg-rojo-claro text-rojo' : 'bg-amarillo-claro text-amber-800'
                    }`}>{a.nivel === 'error' ? '✗' : '⚠'} {a.mensaje}</div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">Clientes bloqueados ({">"} $50k deuda)</h3>
            <Link href="/gestion/cobranzas" className="text-xs text-verde-oscuro hover:underline">Ver cobranzas</Link>
          </div>
          {clientesBloqueados.length === 0 ? (
            <p className="text-gray-500 text-sm">Ningún cliente bloqueado</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {clientesBloqueados.slice(0, 10).map(c => (
                <div key={c.id} className="flex justify-between text-sm border-b pb-1">
                  <span className="text-gray-800 truncate pr-2">{c.razon_social}</span>
                  <span className="text-rojo font-medium whitespace-nowrap">{formatCurrency(c.saldo_cuenta_corriente)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Últimos pedidos */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">Últimos pedidos</h3>
          <Link href="/gestion/pedidos" className="text-xs text-verde-oscuro hover:underline">Ver todos</Link>
        </div>
        {ultimosPedidos.length === 0 ? (
          <p className="text-gray-500 text-sm">Sin pedidos aún</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs bg-gray-50">
                  <th className="text-left px-3 py-2 font-medium">Número</th>
                  <th className="text-left px-3 py-2 font-medium">Vendedor</th>
                  <th className="text-left px-3 py-2 font-medium">Cliente</th>
                  <th className="text-left px-3 py-2 font-medium">Entrega</th>
                  <th className="text-right px-3 py-2 font-medium">Total</th>
                  <th className="text-center px-3 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ultimosPedidos.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs text-gray-800">{p.numero}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{p.vendedor_nombre}</td>
                    <td className="px-3 py-2 text-gray-800">{p.cliente_razon_social}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{formatDate(p.fecha_entrega)}</td>
                    <td className="px-3 py-2 text-right font-medium text-gray-800">{formatCurrency(p.total)}</td>
                    <td className="px-3 py-2 text-center">
                      <EstadoBadge estado={p.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, color, small }: { label: string; value: string; color: string; small?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <p className={small ? "text-lg font-bold truncate" : "text-2xl font-bold"}>{value}</p>
      <p className="text-xs opacity-70 mt-1">{label}</p>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    pendiente: 'bg-amarillo-claro text-amber-800',
    aprobado: 'bg-verde-ok-claro text-verde-ok',
    enviado: 'bg-blue-100 text-blue-800',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[estado] || ''}`}>{estado}</span>;
}
