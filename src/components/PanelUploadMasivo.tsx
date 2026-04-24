'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

type Entity = 'clientes' | 'productos' | 'lista_precio';

type UploadResult = {
  ok: boolean;
  leidos?: number;
  deleted?: number;
  inserted?: number;
  error?: string;
};

// Panel de carga masiva con REEMPLAZO TOTAL.
// Sólo admin. Requiere DATA_SOURCE=baserow en el server.
export default function PanelUploadMasivo() {
  const { isAdmin } = useAuth();
  const [entity, setEntity] = useState<Entity>('clientes');
  const [file, setFile] = useState<File | null>(null);
  const [listaId, setListaId] = useState('lp_general');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <p className="text-sm text-gray-500">Sólo administradores pueden acceder a esta sección.</p>
      </div>
    );
  }

  const labelEntity: Record<Entity, string> = {
    clientes: 'Clientes',
    productos: 'Productos',
    lista_precio: 'Lista de precios',
  };
  const columnasEsperadas: Record<Entity, string[]> = {
    clientes: ['id', 'razon_social', 'cuit', 'direccion', 'telefono', 'localidad', 'provincia', 'condicion_pago', 'dias_pago', 'saldo_cuenta_corriente', 'vendedor_id', 'lista_precio_id', 'zona', 'recorrido'],
    productos: ['id', 'codigo', 'descripcion', 'unidad', 'unidades_por_caja', 'peso_promedio_kg', 'categoria', 'marca', 'nombre_produccion', 'activo'],
    lista_precio: ['codigo', 'producto_id', 'precio'],
  };

  const handleUpload = async () => {
    if (!file) {
      alert('Seleccioná un archivo');
      return;
    }
    if (!confirmar) {
      alert('Tenés que confirmar que entendés que se reemplazan TODOS los datos.');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('entity', entity);
      if (entity === 'lista_precio') form.append('lista_id', listaId);
      const res = await fetch('/api/admin/upload', { method: 'POST', body: form });
      const data = (await res.json()) as UploadResult;
      setResult(data);
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : 'Error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-verde-oscuro">Datos maestros — carga masiva</h1>
        <p className="text-gray-500 text-sm">Subí un Excel/CSV para reemplazar <strong>totalmente</strong> los datos existentes.</p>
      </div>

      <div className="bg-rojo-claro border border-rojo/40 rounded-lg p-3 text-sm text-rojo">
        <strong>⚠ Atención:</strong> este proceso <strong>borra todos los registros existentes</strong> de la entidad seleccionada y los reemplaza por el contenido del archivo. No hay deshacer.
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Entidad a reemplazar</label>
          <select
            value={entity}
            onChange={(e) => { setEntity(e.target.value as Entity); setResult(null); }}
            className="w-full px-3 py-2 border rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-verde-oscuro outline-none"
          >
            <option value="clientes">Clientes</option>
            <option value="productos">Productos</option>
            <option value="lista_precio">Lista de precios (por ID de lista)</option>
          </select>
        </div>

        {entity === 'lista_precio' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ID de la lista</label>
            <input
              value={listaId}
              onChange={(e) => setListaId(e.target.value)}
              placeholder="lp_general"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-verde-oscuro outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">Se reemplazan sólo los precios de esta lista. Otras listas quedan intactas.</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Archivo (.xlsx o .csv)</label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }}
            className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-verde-oscuro file:text-white file:text-sm hover:file:bg-verde-claro"
          />
          {file && <p className="text-xs text-gray-500 mt-1">{file.name} ({(file.size / 1024).toFixed(1)} kB)</p>}
        </div>

        <div>
          <p className="text-xs text-gray-600 mb-1">Columnas esperadas en la planilla (nombres flexibles — se aceptan variantes con/sin tilde y mayúsculas):</p>
          <div className="flex flex-wrap gap-1">
            {columnasEsperadas[entity].map((c) => (
              <span key={c} className="text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">{c}</span>
            ))}
          </div>
        </div>

        <label className="flex items-start gap-2 pt-2">
          <input
            type="checkbox"
            checked={confirmar}
            onChange={(e) => setConfirmar(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-sm text-gray-700">
            Entiendo que se <strong>reemplazan TODOS los registros</strong> de <strong>{labelEntity[entity]}</strong>
            {entity === 'lista_precio' ? ` (lista ${listaId})` : ''} y que no hay deshacer.
          </span>
        </label>

        <div className="pt-2">
          <button
            onClick={handleUpload}
            disabled={loading || !file || !confirmar}
            className="bg-verde-oscuro text-white px-5 py-2 rounded-lg font-medium hover:bg-verde-claro disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Procesando…' : 'Reemplazar datos'}
          </button>
        </div>

        {result && (
          <div className={`rounded-lg p-3 text-sm ${result.ok ? 'bg-verde-ok-claro text-verde-ok' : 'bg-rojo-claro text-rojo'}`}>
            {result.ok ? (
              <>
                ✓ Reemplazo completo. Leídos <strong>{result.leidos}</strong>, borrados <strong>{result.deleted}</strong>, insertados <strong>{result.inserted}</strong>.
              </>
            ) : (
              <>✗ Error: {result.error}</>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
