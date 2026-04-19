'use client';

import { useState, useEffect, useMemo } from 'react';
import { Producto, ListaPrecio } from '@/types';
import { formatCurrency } from '@/lib/format';

// Módulo catálogo de Productos con vista de precios por lista
export default function ModuloProductos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [listas, setListas] = useState<ListaPrecio[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [listaSeleccionada, setListaSeleccionada] = useState('lp_general');

  useEffect(() => {
    Promise.all([
      fetch('/api/productos').then(r => r.json()),
      fetch('/api/listas-precio').then(r => r.json()),
    ]).then(([ps, ls]) => {
      setProductos(ps);
      setListas(ls);
    }).finally(() => setLoading(false));
  }, []);

  const lista = listas.find(l => l.id === listaSeleccionada);

  const precioDe = (productoId: string) => {
    return lista?.precios.find(p => p.producto_id === productoId)?.precio || 0;
  };

  const filtrados = useMemo(() => {
    let r = productos;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      r = r.filter(p =>
        p.descripcion.toLowerCase().includes(q) ||
        p.codigo.includes(q) ||
        p.categoria?.toLowerCase().includes(q) ||
        p.marca?.toLowerCase().includes(q)
      );
    }
    return r;
  }, [productos, busqueda]);

  // Agrupar por categoría
  const porCategoria = useMemo(() => {
    const m: Record<string, Producto[]> = {};
    filtrados.forEach(p => {
      const k = p.categoria || 'Sin categoría';
      if (!m[k]) m[k] = [];
      m[k].push(p);
    });
    return Object.entries(m);
  }, [filtrados]);

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
        <h1 className="text-2xl font-bold text-verde-oscuro">Productos</h1>
        <p className="text-gray-500 text-sm">{productos.length} productos activos</p>
      </div>

      <div className="bg-white rounded-xl border p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por código, descripción, categoría..."
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-verde-oscuro outline-none text-gray-800" />
          <select value={listaSeleccionada} onChange={e => setListaSeleccionada(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm text-gray-800">
            {listas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>
        </div>
      </div>

      {porCategoria.map(([cat, prods]) => (
        <div key={cat} className="bg-white rounded-xl border overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b">
            <h3 className="font-semibold text-gray-700 text-sm">{cat} <span className="text-gray-400 font-normal">({prods.length})</span></h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/50 text-gray-500 text-xs">
                  <th className="text-left px-4 py-2 font-medium">Código</th>
                  <th className="text-left px-4 py-2 font-medium">Descripción</th>
                  <th className="text-left px-4 py-2 font-medium">Marca</th>
                  <th className="text-right px-4 py-2 font-medium">U/Caja</th>
                  <th className="text-right px-4 py-2 font-medium">Precio ({lista?.nombre || '—'})</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {prods.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-600">{p.codigo}</td>
                    <td className="px-4 py-2 text-gray-800">{p.descripcion}</td>
                    <td className="px-4 py-2 text-gray-600 text-xs">{p.marca || '—'}</td>
                    <td className="px-4 py-2 text-right text-gray-600 text-xs">{p.unidades_por_caja}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-800">{formatCurrency(precioDe(p.id))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
