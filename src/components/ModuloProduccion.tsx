'use client';

import { useState, useEffect, useMemo } from 'react';
import { Pedido } from '@/types';
import { formatDate } from '@/lib/format';

// Módulo de Producción:
// - Vista agregada por producto: cuántas cajas/unidades/kg hay que producir
// - Filtro por fecha de entrega (rango) y por estado del pedido
// - Agrupación por categoría
export default function ModuloProduccion() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [desde, setDesde] = useState(() => new Date().toISOString().split('T')[0]);
  const [hasta, setHasta] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [estadosIncluidos, setEstadosIncluidos] = useState<Set<string>>(new Set(['pendiente', 'aprobado']));

  useEffect(() => {
    fetch('/api/pedidos')
      .then(r => r.json())
      .then(setPedidos)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleEstado = (e: string) => {
    setEstadosIncluidos(prev => {
      const n = new Set(prev);
      if (n.has(e)) n.delete(e); else n.add(e);
      return n;
    });
  };

  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter(p => {
      if (!estadosIncluidos.has(p.estado)) return false;
      if (desde && p.fecha_entrega < desde) return false;
      if (hasta && p.fecha_entrega > hasta) return false;
      return true;
    });
  }, [pedidos, desde, hasta, estadosIncluidos]);

  // Agregar por producto
  const resumenProducto = useMemo(() => {
    const m = new Map<string, {
      codigo: string;
      descripcion: string;
      categoria: string;
      cajas: number;
      unidades: number;
      kg: number;
      pedidos_count: number;
    }>();
    pedidosFiltrados.forEach(p => {
      (p.lineas || []).forEach(l => {
        const key = l.producto_id;
        if (!m.has(key)) {
          m.set(key, {
            codigo: l.codigo,
            descripcion: l.descripcion,
            categoria: '',
            cajas: 0, unidades: 0, kg: 0, pedidos_count: 0,
          });
        }
        const e = m.get(key)!;
        e.cajas += l.cajas || 0;
        e.unidades += l.cantidad || 0;
        e.kg += l.kg_aprox || 0;
        e.pedidos_count += 1;
      });
    });
    return Array.from(m.values()).sort((a, b) => b.kg - a.kg);
  }, [pedidosFiltrados]);

  const totalCajas = resumenProducto.reduce((s, p) => s + p.cajas, 0);
  const totalUnidades = resumenProducto.reduce((s, p) => s + p.unidades, 0);
  const totalKg = resumenProducto.reduce((s, p) => s + p.kg, 0);

  // Pedidos ordenados por fecha de entrega
  const pedidosPorDia = useMemo(() => {
    const m: Record<string, Pedido[]> = {};
    pedidosFiltrados.forEach(p => {
      const k = p.fecha_entrega;
      if (!m[k]) m[k] = [];
      m[k].push(p);
    });
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]));
  }, [pedidosFiltrados]);

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
        <h1 className="text-2xl font-bold text-verde-oscuro">Producción</h1>
        <p className="text-gray-500 text-sm">Lo que hay que producir según los pedidos</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border p-4 flex flex-col md:flex-row gap-3 items-start md:items-center flex-wrap">
        <div className="flex gap-2 items-center">
          <label className="text-sm text-gray-600">Entrega desde:</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm text-gray-800" />
          <label className="text-sm text-gray-600">hasta:</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm text-gray-800" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['pendiente', 'aprobado', 'enviado'].map(e => (
            <label key={e} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="checkbox" checked={estadosIncluidos.has(e)} onChange={() => toggleEstado(e)}
                className="w-4 h-4 text-verde-oscuro rounded" />
              <span className="text-gray-700 capitalize">{e}</span>
            </label>
          ))}
        </div>
        <span className="text-xs text-gray-500 ml-auto">{pedidosFiltrados.length} pedido(s) en el rango</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-2xl font-bold text-verde-oscuro">{totalCajas}</p>
          <p className="text-xs text-gray-500">Cajas a producir</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-2xl font-bold text-verde-oscuro">{totalUnidades}</p>
          <p className="text-xs text-gray-500">Unidades</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-2xl font-bold text-verde-oscuro">{totalKg.toFixed(1)} kg</p>
          <p className="text-xs text-gray-500">Kg aprox</p>
        </div>
      </div>

      {/* Tabla resumen por producto */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-800 mb-3">Resumen por producto</h3>
        {resumenProducto.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay pedidos en el rango seleccionado</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs">
                  <th className="text-left px-3 py-2 font-medium">Código</th>
                  <th className="text-left px-3 py-2 font-medium">Producto</th>
                  <th className="text-right px-3 py-2 font-medium">Pedidos</th>
                  <th className="text-right px-3 py-2 font-medium">Cajas</th>
                  <th className="text-right px-3 py-2 font-medium">Unidades</th>
                  <th className="text-right px-3 py-2 font-medium">Kg aprox</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {resumenProducto.map(p => (
                  <tr key={p.codigo} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{p.codigo}</td>
                    <td className="px-3 py-2 text-gray-800">{p.descripcion}</td>
                    <td className="px-3 py-2 text-right text-gray-600 text-xs">{p.pedidos_count}</td>
                    <td className="px-3 py-2 text-right font-medium text-gray-800">{p.cajas}</td>
                    <td className="px-3 py-2 text-right text-gray-800">{p.unidades}</td>
                    <td className="px-3 py-2 text-right font-medium text-verde-oscuro">{p.kg.toFixed(1)} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Calendario de entregas */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-800 mb-3">Calendario de entregas</h3>
        {pedidosPorDia.length === 0 ? (
          <p className="text-gray-500 text-sm">Sin entregas programadas</p>
        ) : (
          <div className="space-y-4">
            {pedidosPorDia.map(([fecha, peds]) => {
              const cajasDia = peds.reduce((s, p) => s + (p.lineas || []).reduce((ss, l) => ss + (l.cajas || 0), 0), 0);
              const kgDia = peds.reduce((s, p) => s + (p.lineas || []).reduce((ss, l) => ss + (l.kg_aprox || 0), 0), 0);
              return (
                <div key={fecha} className="border-l-4 border-verde-oscuro pl-3">
                  <div className="flex justify-between items-baseline">
                    <h4 className="font-semibold text-gray-800">{formatDate(fecha)}</h4>
                    <p className="text-xs text-gray-500">{peds.length} pedido(s) · {cajasDia} cajas · {kgDia.toFixed(1)} kg</p>
                  </div>
                  <div className="mt-1 space-y-0.5 text-xs">
                    {peds.map(p => (
                      <div key={p.id} className="text-gray-600">
                        <span className="font-mono text-gray-400">{p.numero}</span> — {p.cliente_razon_social}
                        <span className="ml-2 text-gray-400">({p.vendedor_nombre})</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
