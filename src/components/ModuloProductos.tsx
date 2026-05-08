'use client';

import { useState, useEffect, useMemo } from 'react';
import { Producto, ListaPrecio } from '@/types';
import { formatCurrency } from '@/lib/format';

const productoVacio = (): Producto => ({
  id: '',
  codigo: '',
  descripcion: '',
  unidad: 'unidad',
  unidades_por_caja: undefined,
  peso_promedio_kg: undefined,
  categoria: '',
  marca: '',
  nombre_produccion: '',
  activo: true,
});

// Módulo catálogo de Productos con vista de precios + CRUD
export default function ModuloProductos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [listas, setListas] = useState<ListaPrecio[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [listaSeleccionada, setListaSeleccionada] = useState('lp_general');
  const [editando, setEditando] = useState<Producto | null>(null);
  const [esNuevo, setEsNuevo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const [ps, ls] = await Promise.all([
        fetch('/api/productos?fresh=1&all=1').then(r => r.json()),
        fetch('/api/listas-precio').then(r => r.json()),
      ]);
      setProductos(ps);
      setListas(ls);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const lista = listas.find(l => l.id === listaSeleccionada);
  const precioDe = (productoId: string) =>
    lista?.precios.find(p => p.producto_id === productoId)?.precio || 0;

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

  const porCategoria = useMemo(() => {
    const m: Record<string, Producto[]> = {};
    filtrados.forEach(p => {
      const k = p.categoria || 'Sin categoría';
      if (!m[k]) m[k] = [];
      m[k].push(p);
    });
    return Object.entries(m);
  }, [filtrados]);

  // ---- CRUD handlers ----
  const abrirNuevo = () => { setEditando(productoVacio()); setEsNuevo(true); };
  const abrirEditar = (p: Producto) => { setEditando({ ...p }); setEsNuevo(false); };
  const cerrar = () => { setEditando(null); setEsNuevo(false); };

  const guardar = async () => {
    if (!editando) return;
    if (!editando.codigo.trim() || !editando.descripcion.trim()) {
      alert('Código y descripción son obligatorios');
      return;
    }
    setGuardando(true);
    try {
      const method = esNuevo ? 'POST' : 'PATCH';
      const body = esNuevo
        ? { ...editando, id: editando.id || `prod_${editando.codigo}` }
        : editando;
      const res = await fetch('/api/productos', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) {
        alert('Error: ' + (data.error || 'desconocido'));
        return;
      }
      cerrar();
      await cargar();
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (p: Producto) => {
    if (!confirm(`¿Eliminar el producto "${p.descripcion}"?`)) return;
    setGuardando(true);
    try {
      const res = await fetch(`/api/productos?id=${encodeURIComponent(p.id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) { alert('Error: ' + (data.error || 'desconocido')); return; }
      await cargar();
    } finally {
      setGuardando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-verde-oscuro border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-verde-oscuro">Productos</h1>
          <p className="text-gray-500 text-sm">{productos.length} productos en el catálogo</p>
        </div>
        <button onClick={abrirNuevo}
          className="bg-verde-oscuro text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-verde-claro flex items-center gap-2">
          + Nuevo producto
        </button>
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
                  <th className="text-right px-4 py-2 font-medium">Kg/u</th>
                  <th className="text-right px-4 py-2 font-medium">Precio ({lista?.nombre || '—'})</th>
                  <th className="text-center px-4 py-2 font-medium">Activo</th>
                  <th className="px-4 py-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {prods.map(p => (
                  <tr key={p.id} className={`hover:bg-gray-50 ${p.activo ? '' : 'opacity-50'}`}>
                    <td className="px-4 py-2 font-mono text-xs text-gray-600">{p.codigo}</td>
                    <td className="px-4 py-2 text-gray-800">{p.descripcion}</td>
                    <td className="px-4 py-2 text-gray-600 text-xs">{p.marca || '—'}</td>
                    <td className="px-4 py-2 text-right text-gray-600 text-xs">{p.unidades_por_caja ?? '—'}</td>
                    <td className="px-4 py-2 text-right text-gray-600 text-xs">{p.peso_promedio_kg ?? '—'}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-800">{formatCurrency(precioDe(p.id))}</td>
                    <td className="px-4 py-2 text-center text-xs">{p.activo ? '✓' : '✗'}</td>
                    <td className="px-4 py-2 space-x-3 whitespace-nowrap">
                      <button onClick={() => abrirEditar(p)} className="text-verde-oscuro hover:underline text-xs font-medium">Editar</button>
                      <button onClick={() => borrar(p)} className="text-rojo hover:underline text-xs font-medium">Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Modal de edición */}
      {editando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="border-b px-5 py-3 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-verde-oscuro">
                {esNuevo ? 'Nuevo producto' : `Editar ${editando.descripcion}`}
              </h2>
              <button onClick={cerrar} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Código *" value={editando.codigo} onChange={v => setEditando({ ...editando, codigo: v })} />
              <Field label="Descripción *" value={editando.descripcion} onChange={v => setEditando({ ...editando, descripcion: v })} />
              <Field label="Marca" value={editando.marca || ''} onChange={v => setEditando({ ...editando, marca: v })} />
              <Field label="Categoría" value={editando.categoria || ''} onChange={v => setEditando({ ...editando, categoria: v })} />
              <Field label="Unidad" value={editando.unidad} onChange={v => setEditando({ ...editando, unidad: v })} />
              <Field label="Nombre producción" value={editando.nombre_produccion || ''} onChange={v => setEditando({ ...editando, nombre_produccion: v })} />
              <NumberField label="Unidades por caja" value={editando.unidades_por_caja} onChange={v => setEditando({ ...editando, unidades_por_caja: v })} />
              <NumberField label="Kg promedio / unidad" value={editando.peso_promedio_kg} onChange={v => setEditando({ ...editando, peso_promedio_kg: v })} step="0.01" />
              <label className="flex items-center gap-2 col-span-2 text-sm">
                <input type="checkbox" checked={editando.activo} onChange={e => setEditando({ ...editando, activo: e.target.checked })} />
                <span>Activo (visible en el formulario de pedidos)</span>
              </label>
            </div>
            <div className="border-t px-5 py-3 flex justify-end gap-2 sticky bottom-0 bg-white">
              <button onClick={cerrar} className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50">Cancelar</button>
              <button onClick={guardar} disabled={guardando}
                className="px-5 py-2 rounded-lg text-sm bg-verde-oscuro text-white font-medium hover:bg-verde-claro disabled:opacity-50">
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="text-gray-700 font-medium">{label}</span>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-verde-oscuro outline-none" />
    </label>
  );
}

function NumberField({ label, value, onChange, step = '1' }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; step?: string }) {
  return (
    <label className="block text-sm">
      <span className="text-gray-700 font-medium">{label}</span>
      <input type="number" step={step} value={value ?? ''} onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-verde-oscuro outline-none" />
    </label>
  );
}
