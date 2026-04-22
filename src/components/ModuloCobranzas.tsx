'use client';

import { useState, useEffect, useMemo } from 'react';
import { Cliente, Vendedor, EstadoCuenta } from '@/types';
import { formatCurrency } from '@/lib/format';
import { estadoCuentaDe, estadoLabel, estadoColor, LIMITE_BLOQUEO } from '@/lib/cliente';

// Módulo de Cobranzas:
// - KPIs de deuda
// - Ranking por provincia
// - Tabla filtrable por estado de cuenta y por vendedor
// - Permite cambiar manualmente el estado de cuenta de cada cliente
type FiltroEstado = 'todos' | EstadoCuenta;

export default function ModuloCobranzas() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
  const [filtroVendedor, setFiltroVendedor] = useState<string>('todos');
  const [actualizando, setActualizando] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/clientes').then(r => r.json()),
      fetch('/api/vendedores').then(r => r.json()),
    ])
      .then(([cs, vs]) => { setClientes(cs); setVendedores(vs); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const vendedorById = useMemo(() => {
    const m: Record<string, Vendedor> = {};
    vendedores.forEach(v => { m[v.id] = v; });
    return m;
  }, [vendedores]);

  const cambiarEstado = async (id: string, nuevo: EstadoCuenta) => {
    setActualizando(id);
    try {
      const res = await fetch('/api/clientes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado_cuenta: nuevo }),
      });
      const data = await res.json();
      if (data.ok) {
        setClientes(prev => prev.map(c => c.id === id ? { ...c, estado_cuenta: nuevo } : c));
      } else {
        alert('Error al actualizar estado');
      }
    } catch {
      alert('Error de conexión');
    } finally {
      setActualizando(null);
    }
  };

  // Universo filtrado — se aplica a TODO (KPIs + ranking + tabla).
  // Además ocultamos clientes con saldo=0 (no son gestionables por cobranzas).
  const universo = useMemo(() => {
    let res = clientes.filter(c => c.saldo_cuenta_corriente !== 0);

    if (filtroEstado !== 'todos') {
      res = res.filter(c => estadoCuentaDe(c) === filtroEstado);
    }
    if (filtroVendedor !== 'todos') {
      res = res.filter(c => (c.vendedor_id || '') === filtroVendedor);
    }
    return res;
  }, [clientes, filtroEstado, filtroVendedor]);

  const clientesFiltrados = useMemo(() => {
    let res = universo;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      res = res.filter(c =>
        c.razon_social.toLowerCase().includes(q) ||
        c.cuit?.includes(q) ||
        c.localidad?.toLowerCase().includes(q) ||
        c.provincia?.toLowerCase().includes(q)
      );
    }
    return [...res].sort((a, b) => a.saldo_cuenta_corriente - b.saldo_cuenta_corriente);
  }, [universo, busqueda]);

  // KPIs — sobre el universo filtrado
  const cantAlDia = universo.filter(c => estadoCuentaDe(c) === 'al_dia').length;
  const cantObservado = universo.filter(c => estadoCuentaDe(c) === 'observado').length;
  const cantBloqueado = universo.filter(c => estadoCuentaDe(c) === 'bloqueado').length;
  const totalDeuda = universo.reduce((s, c) => s + (c.saldo_cuenta_corriente < 0 ? Math.abs(c.saldo_cuenta_corriente) : 0), 0);

  // Resumen de deuda por vendedor (solo clientes con deuda dentro del universo filtrado)
  const resumenVendedor = useMemo(() => {
    const m: Record<string, { nombre: string; count: number; deuda: number }> = {};
    universo.filter(c => c.saldo_cuenta_corriente < 0).forEach(c => {
      const vid = c.vendedor_id || '__sin__';
      const nombre = vid === '__sin__' ? 'Sin vendedor' : (vendedorById[vid]?.nombre || 'Sin vendedor');
      if (!m[vid]) m[vid] = { nombre, count: 0, deuda: 0 };
      m[vid].count++;
      m[vid].deuda += Math.abs(c.saldo_cuenta_corriente);
    });
    return Object.values(m).sort((a, b) => b.deuda - a.deuda);
  }, [universo, vendedorById]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-verde-oscuro border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-verde-oscuro">Cobranzas</h1>
        <p className="text-gray-500 text-sm">Gestión de cuentas corrientes y estados</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-2xl font-bold text-gray-800">{universo.length}</p>
          <p className="text-xs text-gray-500">Clientes con saldo</p>
        </div>
        <div className="bg-verde-ok-claro rounded-xl border border-verde-ok/30 p-4">
          <p className="text-2xl font-bold text-verde-ok">{cantAlDia}</p>
          <p className="text-xs text-green-700">Al día</p>
        </div>
        <div className="bg-amarillo-claro rounded-xl border border-amarillo/30 p-4">
          <p className="text-2xl font-bold text-amber-800">{cantObservado}</p>
          <p className="text-xs text-amber-700">Observados</p>
        </div>
        <div className="bg-rojo-claro rounded-xl border border-rojo/30 p-4">
          <p className="text-2xl font-bold text-rojo">{cantBloqueado}</p>
          <p className="text-xs text-red-700">Bloqueados</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-lg font-bold text-rojo truncate">{formatCurrency(totalDeuda)}</p>
          <p className="text-xs text-gray-500">Deuda total</p>
        </div>
      </div>

      {/* Criterio (explicativo) */}
      <div className="bg-gray-50 border rounded-lg p-3 text-xs text-gray-600">
        <strong className="text-gray-700">Criterio de estados:</strong>{' '}
        saldo ≥ 0 → <span className="font-medium text-verde-ok">Al día</span>;{' '}
        entre {formatCurrency(LIMITE_BLOQUEO)} y 0 → <span className="font-medium text-amber-800">Observado</span>;{' '}
        menor a {formatCurrency(LIMITE_BLOQUEO)} → <span className="font-medium text-rojo">Bloqueado</span>.
        Se puede sobrescribir manualmente desde el selector de cada fila.
      </div>

      {/* Resumen de deuda por vendedor */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-800 mb-3">Resumen de deuda por vendedor</h3>
        {resumenVendedor.length === 0 ? (
          <p className="text-sm text-gray-500">Sin deuda en el filtro seleccionado</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {resumenVendedor.map(v => (
              <div key={v.nombre} className="flex justify-between border-b pb-1">
                <span className="text-gray-700">{v.nombre} <span className="text-gray-400">({v.count})</span></span>
                <span className="font-medium text-rojo">{formatCurrency(v.deuda)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filtros + búsqueda */}
      <div className="flex flex-col md:flex-row gap-3">
        <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por razón social, CUIT, localidad o provincia..."
          className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-verde-oscuro outline-none text-gray-800" />
        <select value={filtroVendedor} onChange={e => setFiltroVendedor(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm text-gray-800">
          <option value="todos">Todos los vendedores</option>
          {vendedores.filter(v => v.rol !== 'admin').map(v => (
            <option key={v.id} value={v.id}>{v.nombre}</option>
          ))}
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as FiltroEstado)}
          className="px-3 py-2 border rounded-lg text-sm text-gray-800">
          <option value="todos">Todos los estados</option>
          <option value="al_dia">Al día</option>
          <option value="observado">Observados</option>
          <option value="bloqueado">Bloqueados</option>
        </select>
      </div>

      {/* Tabla clientes */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs">
                <th className="text-left px-3 py-2 font-medium">Razón social</th>
                <th className="text-left px-3 py-2 font-medium">Vendedor</th>
                <th className="text-left px-3 py-2 font-medium">CUIT</th>
                <th className="text-left px-3 py-2 font-medium">Localidad</th>
                <th className="text-left px-3 py-2 font-medium">Provincia</th>
                <th className="text-left px-3 py-2 font-medium">Condición</th>
                <th className="text-right px-3 py-2 font-medium">Saldo</th>
                <th className="text-center px-3 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {clientesFiltrados.slice(0, 200).map(c => {
                const estado = estadoCuentaDe(c);
                const vendNombre = c.vendedor_id ? (vendedorById[c.vendedor_id]?.nombre || '—') : '—';
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-800 font-medium">{c.razon_social}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{vendNombre}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs font-mono">{c.cuit || '—'}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{c.localidad || '—'}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{c.provincia || '—'}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{c.condicion_pago}</td>
                    <td className={`px-3 py-2 text-right font-medium ${
                      c.saldo_cuenta_corriente < LIMITE_BLOQUEO ? 'text-rojo' :
                      c.saldo_cuenta_corriente < 0 ? 'text-amber-700' :
                      c.saldo_cuenta_corriente > 0 ? 'text-verde-ok' : 'text-gray-800'
                    }`}>
                      {formatCurrency(c.saldo_cuenta_corriente)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="inline-flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoColor[estado]}`}>
                          {estadoLabel[estado]}
                        </span>
                        <select
                          value={c.estado_cuenta || ''}
                          disabled={actualizando === c.id}
                          onChange={(e) => cambiarEstado(c.id, e.target.value as EstadoCuenta)}
                          className="text-[11px] px-1 py-0.5 border rounded text-gray-700 bg-white"
                          title="Cambiar estado manual"
                        >
                          <option value="">(auto)</option>
                          <option value="al_dia">Al día</option>
                          <option value="observado">Observado</option>
                          <option value="bloqueado">Bloqueado</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {clientesFiltrados.length > 200 && (
            <div className="px-4 py-2 text-center text-xs text-gray-500 border-t">
              Mostrando 200 de {clientesFiltrados.length} resultados — refiná la búsqueda para ver más
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
