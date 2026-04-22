'use client';

import { useState, useEffect, useMemo } from 'react';
import { TipoPlanilla } from '@/types';

// Componente genérico para las planillas de producción (Elaboración, Envasado,
// Expedición, Facturación). Renderiza una tabla con todas las columnas, un
// formulario de alta (modal) y botones de cierre de planilla.
//
// Cada tipo declara su `campos` (qué mostrar en el form / tabla) y este
// componente se encarga del resto.

export interface CampoPlanilla {
  key: string;
  label: string;
  tipo?: 'text' | 'number' | 'date' | 'time' | 'select' | 'checkbox';
  opciones?: string[]; // para tipo 'select'
  ancho?: string;      // tailwind w-*
  paso?: number;
  placeholder?: string;
  grupo?: string;      // para agrupar en el form
}

interface Props {
  tipo: TipoPlanilla;
  titulo: string;
  campos: CampoPlanilla[];
  defaultsExtra?: Record<string, unknown>; // valores por defecto al abrir el form
  hist?: boolean;
  recargarToken?: number;
}

export default function PlanillaGenerica({ tipo, titulo, campos, defaultsExtra, hist = false, recargarToken = 0 }: Props) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [abiertaAlta, setAbiertaAlta] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [guardando, setGuardando] = useState(false);

  const recargar = () => {
    setLoading(true);
    const url = `/api/produccion/${tipo}${hist ? '?hist=1' : ''}`;
    fetch(url)
      .then(r => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { recargar(); /* eslint-disable-next-line */ }, [tipo, hist, recargarToken]);

  const rowsFiltradas = useMemo(() => {
    if (!busqueda.trim()) return rows;
    const q = busqueda.toLowerCase();
    return rows.filter(r => JSON.stringify(r).toLowerCase().includes(q));
  }, [rows, busqueda]);

  const guardar = async (datos: Record<string, unknown>) => {
    setGuardando(true);
    try {
      if (editRow?.id) {
        await fetch(`/api/produccion/${tipo}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editRow.id, cambios: datos }),
        });
      } else {
        await fetch(`/api/produccion/${tipo}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...defaultsExtra, ...datos }),
        });
      }
      setAbiertaAlta(false);
      setEditRow(null);
      recargar();
    } catch {
      alert('Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (id: string) => {
    if (!confirm('¿Borrar este registro?')) return;
    await fetch(`/api/produccion/${tipo}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    recargar();
  };

  const cerrar = async () => {
    if (!confirm('¿Cerrar planilla? Las filas abiertas pasan al histórico.')) return;
    const res = await fetch('/api/produccion/cerrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo }),
    });
    const data = await res.json();
    alert(`Cierre OK. Movidas: ${data.movidas ?? '-'}`);
    recargar();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <h2 className="text-lg font-semibold text-gray-800">{titulo} {hist && <span className="text-gray-400 text-sm">(histórico)</span>}</h2>
        <input
          type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar..."
          className="flex-1 md:max-w-sm px-3 py-1.5 border rounded-lg text-sm text-gray-800"
        />
        {!hist && (
          <>
            <button onClick={() => { setEditRow(null); setAbiertaAlta(true); }}
              className="px-4 py-1.5 bg-verde-oscuro text-white rounded-lg text-sm hover:bg-green-900">
              + Nuevo registro
            </button>
            <button onClick={cerrar}
              className="px-4 py-1.5 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700">
              Cerrar planilla
            </button>
          </>
        )}
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[65vh]">
          <table className="text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="text-gray-600">
                {campos.map(c => (
                  <th key={c.key} className="text-left px-2 py-2 font-medium whitespace-nowrap">{c.label}</th>
                ))}
                {!hist && <th className="px-2 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td className="px-2 py-6 text-center text-gray-400" colSpan={campos.length + 1}>Cargando...</td></tr>
              ) : rowsFiltradas.length === 0 ? (
                <tr><td className="px-2 py-6 text-center text-gray-400" colSpan={campos.length + 1}>Sin registros</td></tr>
              ) : rowsFiltradas.map((r, i) => (
                <tr key={String(r.id || i)} className="hover:bg-gray-50">
                  {campos.map(c => (
                    <td key={c.key} className="px-2 py-1.5 text-gray-700 whitespace-nowrap">
                      {formatCell(r[c.key], c.tipo)}
                    </td>
                  ))}
                  {!hist && (
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      <button onClick={() => { setEditRow(r); setAbiertaAlta(true); }}
                        className="text-verde-oscuro hover:underline mr-2">editar</button>
                      <button onClick={() => borrar(String(r.id))}
                        className="text-rojo hover:underline">x</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 text-xs text-gray-500 border-t bg-gray-50">
          {rowsFiltradas.length} / {rows.length} registros
        </div>
      </div>

      {abiertaAlta && (
        <FormularioModal
          titulo={editRow ? `Editar ${titulo.toLowerCase()}` : `Nuevo ${titulo.toLowerCase()}`}
          campos={campos}
          valorInicial={editRow || defaultsExtra || {}}
          guardando={guardando}
          onGuardar={guardar}
          onCerrar={() => { setAbiertaAlta(false); setEditRow(null); }}
        />
      )}
    </div>
  );
}

function formatCell(v: unknown, tipo?: string): string {
  if (v === null || v === undefined || v === '') return '—';
  if (tipo === 'checkbox') return v ? '✓' : '';
  if (v instanceof Date) return v.toISOString().split('T')[0];
  if (typeof v === 'string' && v.includes('T') && v.length > 15) return v.split('T')[0];
  return String(v);
}

// --- FormularioModal ---
interface FormProps {
  titulo: string;
  campos: CampoPlanilla[];
  valorInicial: Record<string, unknown>;
  guardando: boolean;
  onGuardar: (d: Record<string, unknown>) => void;
  onCerrar: () => void;
}

function FormularioModal({ titulo, campos, valorInicial, guardando, onGuardar, onCerrar }: FormProps) {
  const [datos, setDatos] = useState<Record<string, unknown>>(valorInicial);

  const grupos = useMemo(() => {
    const g: Record<string, CampoPlanilla[]> = {};
    campos.forEach(c => {
      const gName = c.grupo || 'General';
      if (!g[gName]) g[gName] = [];
      g[gName].push(c);
    });
    return g;
  }, [campos]);

  const set = (k: string, v: unknown) => setDatos(prev => ({ ...prev, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b px-5 py-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">{titulo}</h3>
          <button onClick={onCerrar} className="text-gray-500 hover:text-gray-800">✕</button>
        </div>
        <div className="p-5 space-y-5">
          {Object.entries(grupos).map(([grupo, cs]) => (
            <div key={grupo}>
              <h4 className="text-xs font-semibold text-verde-oscuro uppercase mb-2">{grupo}</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {cs.map(c => (
                  <CampoInput key={c.key} campo={c} valor={datos[c.key]} onChange={(v) => set(c.key, v)} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="sticky bottom-0 bg-white border-t px-5 py-3 flex justify-end gap-2">
          <button onClick={onCerrar} className="px-4 py-1.5 border rounded-lg text-sm text-gray-700">Cancelar</button>
          <button
            disabled={guardando}
            onClick={() => onGuardar(datos)}
            className="px-4 py-1.5 bg-verde-oscuro text-white rounded-lg text-sm hover:bg-green-900 disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CampoInput({ campo, valor, onChange }: { campo: CampoPlanilla; valor: unknown; onChange: (v: unknown) => void; }) {
  const cls = 'w-full px-2 py-1.5 border rounded text-sm text-gray-800';
  const v = valor ?? '';
  if (campo.tipo === 'select') {
    return (
      <label className="text-xs text-gray-600">
        <span className="block mb-1">{campo.label}</span>
        <select className={cls} value={String(v)} onChange={e => onChange(e.target.value)}>
          <option value="">—</option>
          {(campo.opciones || []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
    );
  }
  if (campo.tipo === 'checkbox') {
    return (
      <label className="text-xs text-gray-600 flex items-center gap-2 pt-5">
        <input type="checkbox" checked={!!v} onChange={e => onChange(e.target.checked)} className="w-4 h-4" />
        {campo.label}
      </label>
    );
  }
  return (
    <label className="text-xs text-gray-600">
      <span className="block mb-1">{campo.label}</span>
      <input
        className={cls}
        type={campo.tipo || 'text'}
        step={campo.paso}
        placeholder={campo.placeholder}
        value={String(v)}
        onChange={e => onChange(campo.tipo === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
      />
    </label>
  );
}
