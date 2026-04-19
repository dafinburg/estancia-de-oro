'use client';

import { useState, useEffect, useMemo } from 'react';
import { Cliente, Vendedor } from '@/types';
import { formatCurrency } from '@/lib/format';

// Módulo de catálogo de Clientes:
// - Listado completo con búsqueda
// - Filtro por vendedor, provincia, condición de pago
export default function ModuloClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroVendedor, setFiltroVendedor] = useState('');
  const [filtroProvincia, setFiltroProvincia] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/clientes').then(r => r.json()),
      fetch('/api/vendedores').then(r => r.json()).catch(() => []),
    ]).then(([cs, vs]) => {
      setClientes(cs);
      setVendedores(vs);
    }).finally(() => setLoading(false));
  }, []);

  const provincias = useMemo(() => {
    const s = new Set<string>();
    clientes.forEach(c => { if (c.provincia) s.add(c.provincia); });
    return Array.from(s).sort();
  }, [clientes]);

  const filtrados = useMemo(() => {
    let r = clientes;
    if (filtroVendedor) r = r.filter(c => c.vendedor_id === filtroVendedor);
    if (filtroProvincia) r = r.filter(c => c.provincia === filtroProvincia);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      r = r.filter(c =>
        c.razon_social.toLowerCase().includes(q) ||
        c.cuit?.includes(q) ||
        c.localidad?.toLowerCase().includes(q) ||
        c.telefono?.includes(q)
      );
    }
    return r;
  }, [clientes, filtroVendedor, filtroProvincia, busqueda]);

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
        <h1 className="text-2xl font-bold text-verde-oscuro">Clientes</h1>
        <p className="text-gray-500 text-sm">{clientes.length} clientes en el sistema</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por razón social, CUIT, localidad, teléfono..."
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-verde-oscuro outline-none text-gray-800" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select value={filtroVendedor} onChange={e => setFiltroVendedor(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm text-gray-800">
            <option value="">Todos los vendedores</option>
            {vendedores.filter(v => v.id !== 'admin').map(v => (
              <option key={v.id} value={v.id}>{v.nombre}</option>
            ))}
          </select>
          <select value={filtroProvincia} onChange={e => setFiltroProvincia(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm text-gray-800">
            <option value="">Todas las provincias</option>
            {provincias.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <p className="text-xs text-gray-500">Resultados: {filtrados.length}</p>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs">
                <th className="text-left px-4 py-2 font-medium">#</th>
                <th className="text-left px-4 py-2 font-medium">Razón social</th>
                <th className="text-left px-4 py-2 font-medium">CUIT</th>
                <th className="text-left px-4 py-2 font-medium">Localidad / Provincia</th>
                <th className="text-left px-4 py-2 font-medium">Teléfono</th>
                <th className="text-left px-4 py-2 font-medium">Condición</th>
                <th className="text-right px-4 py-2 font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtrados.slice(0, 200).map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-500 text-xs font-mono">{c.numero}</td>
                  <td className="px-4 py-2 text-gray-800 font-medium">{c.razon_social}</td>
                  <td className="px-4 py-2 text-gray-600 text-xs font-mono">{c.cuit || '—'}</td>
                  <td className="px-4 py-2 text-gray-600 text-xs">
                    {c.localidad || '—'}{c.provincia ? `, ${c.provincia}` : ''}
                  </td>
                  <td className="px-4 py-2 text-gray-600 text-xs">{c.telefono || '—'}</td>
                  <td className="px-4 py-2 text-gray-600 text-xs">{c.condicion_pago}</td>
                  <td className={`px-4 py-2 text-right text-xs font-medium ${
                    c.saldo_cuenta_corriente < 0 ? 'text-rojo' :
                    c.saldo_cuenta_corriente > 0 ? 'text-verde-ok' : 'text-gray-500'
                  }`}>{formatCurrency(c.saldo_cuenta_corriente)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtrados.length > 200 && (
            <div className="px-4 py-2 text-center text-xs text-gray-500 border-t">
              Mostrando 200 de {filtrados.length} — refiná la búsqueda para ver más
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
