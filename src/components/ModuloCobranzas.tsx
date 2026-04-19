'use client';

import { useState, useEffect, useMemo } from 'react';
import { Cliente } from '@/types';
import { formatCurrency } from '@/lib/format';

// Módulo de Cobranzas:
// - Lista de clientes con saldo en cuenta corriente
// - Filtros: todos / con deuda / bloqueados
// - Búsqueda por razón social / CUIT / localidad
// - Resumen por provincia
export default function ModuloCobranzas() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'deuda' | 'bloqueados' | 'al_dia'>('deuda');

  useEffect(() => {
    fetch('/api/clientes')
      .then(r => r.json())
      .then(setClientes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const clientesFiltrados = useMemo(() => {
    let res = clientes;
    if (filtro === 'deuda') res = res.filter(c => c.saldo_cuenta_corriente < 0);
    else if (filtro === 'bloqueados') res = res.filter(c => c.saldo_cuenta_corriente < -50000);
    else if (filtro === 'al_dia') res = res.filter(c => c.saldo_cuenta_corriente >= 0);

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      res = res.filter(c =>
        c.razon_social.toLowerCase().includes(q) ||
        c.cuit?.includes(q) ||
        c.localidad?.toLowerCase().includes(q) ||
        c.provincia?.toLowerCase().includes(q)
      );
    }
    return res.sort((a, b) => a.saldo_cuenta_corriente - b.saldo_cuenta_corriente);
  }, [clientes, filtro, busqueda]);

  // Resumen por provincia
  const resumenProvincia = useMemo(() => {
    const m: Record<string, { count: number; deuda: number }> = {};
    clientes.filter(c => c.saldo_cuenta_corriente < 0).forEach(c => {
      const p = c.provincia || 'Sin provincia';
      if (!m[p]) m[p] = { count: 0, deuda: 0 };
      m[p].count++;
      m[p].deuda += Math.abs(c.saldo_cuenta_corriente);
    });
    return Object.entries(m).sort((a, b) => b[1].deuda - a[1].deuda).slice(0, 10);
  }, [clientes]);

  const totalDeuda = clientes.reduce((s, c) => s + (c.saldo_cuenta_corriente < 0 ? Math.abs(c.saldo_cuenta_corriente) : 0), 0);
  const cantDeuda = clientes.filter(c => c.saldo_cuenta_corriente < 0).length;
  const cantBloqueados = clientes.filter(c => c.saldo_cuenta_corriente < -50000).length;

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
        <p className="text-gray-500 text-sm">Gestión de cuentas corrientes y saldos</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-2xl font-bold text-gray-800">{clientes.length}</p>
          <p className="text-xs text-gray-500">Clientes totales</p>
        </div>
        <div className="bg-amarillo-claro rounded-xl border border-amarillo/30 p-4">
          <p className="text-2xl font-bold text-amber-800">{cantDeuda}</p>
          <p className="text-xs text-amber-700">Con deuda</p>
        </div>
        <div className="bg-rojo-claro rounded-xl border border-rojo/30 p-4">
          <p className="text-2xl font-bold text-rojo">{cantBloqueados}</p>
          <p className="text-xs text-red-700">Bloqueados ({">"} $50k)</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-lg font-bold text-rojo truncate">{formatCurrency(totalDeuda)}</p>
          <p className="text-xs text-gray-500">Deuda total</p>
        </div>
      </div>

      {/* Ranking por provincia */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-800 mb-3">Ranking de deuda por provincia</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          {resumenProvincia.map(([prov, data]) => (
            <div key={prov} className="flex justify-between border-b pb-1">
              <span className="text-gray-700">{prov} <span className="text-gray-400">({data.count})</span></span>
              <span className="font-medium text-rojo">{formatCurrency(data.deuda)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros + búsqueda */}
      <div className="flex flex-col md:flex-row gap-3">
        <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por razón social, CUIT, localidad o provincia..."
          className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-verde-oscuro outline-none text-gray-800" />
        <div className="flex gap-2 flex-wrap">
          {([
            ['deuda', `Con deuda (${cantDeuda})`],
            ['bloqueados', `Bloqueados (${cantBloqueados})`],
            ['al_dia', 'Al día'],
            ['todos', 'Todos'],
          ] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFiltro(k)}
              className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                filtro === k ? 'bg-verde-oscuro text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>{l}</button>
          ))}
        </div>
      </div>

      {/* Tabla clientes */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs">
                <th className="text-left px-4 py-2 font-medium">Razón social</th>
                <th className="text-left px-4 py-2 font-medium">CUIT</th>
                <th className="text-left px-4 py-2 font-medium">Localidad</th>
                <th className="text-left px-4 py-2 font-medium">Provincia</th>
                <th className="text-left px-4 py-2 font-medium">Condición</th>
                <th className="text-right px-4 py-2 font-medium">Saldo</th>
                <th className="text-center px-4 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {clientesFiltrados.slice(0, 100).map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-800 font-medium">{c.razon_social}</td>
                  <td className="px-4 py-2 text-gray-600 text-xs font-mono">{c.cuit || '—'}</td>
                  <td className="px-4 py-2 text-gray-600 text-xs">{c.localidad || '—'}</td>
                  <td className="px-4 py-2 text-gray-600 text-xs">{c.provincia || '—'}</td>
                  <td className="px-4 py-2 text-gray-600 text-xs">{c.condicion_pago}</td>
                  <td className={`px-4 py-2 text-right font-medium ${
                    c.saldo_cuenta_corriente < -50000 ? 'text-rojo' :
                    c.saldo_cuenta_corriente < 0 ? 'text-amber-700' :
                    c.saldo_cuenta_corriente > 0 ? 'text-verde-ok' : 'text-gray-800'
                  }`}>
                    {formatCurrency(c.saldo_cuenta_corriente)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {c.saldo_cuenta_corriente < -50000 ? (
                      <span className="text-xs bg-rojo text-white px-2 py-0.5 rounded-full">Bloqueado</span>
                    ) : c.saldo_cuenta_corriente < 0 ? (
                      <span className="text-xs bg-amarillo text-amber-900 px-2 py-0.5 rounded-full">Vencido</span>
                    ) : (
                      <span className="text-xs bg-verde-ok-claro text-verde-ok px-2 py-0.5 rounded-full">Al día</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {clientesFiltrados.length > 100 && (
            <div className="px-4 py-2 text-center text-xs text-gray-500 border-t">
              Mostrando 100 de {clientesFiltrados.length} resultados — refiná la búsqueda para ver más
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
