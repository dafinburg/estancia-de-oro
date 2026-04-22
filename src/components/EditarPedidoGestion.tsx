'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Pedido, EstadoPedido, LineaPedido } from '@/types';
import { formatCurrency, formatDate } from '@/lib/format';

// Pantalla de detalle + edición de pedido para el back-office.
// - Ve todo el detalle del pedido (sobrevive a normalizeFromSheet del backend).
// - Permite editar campos clave: fecha entrega, dirección, transporte, notas
//   y las líneas (cantidad, precio unitario, descuento %).
// - Permite cambiar estado (pendiente → aprobado → enviado).
// - Guarda vía PATCH /api/pedidos con {id, cambios}.
export default function EditarPedidoGestion() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Campos editables (se inicializan desde el pedido)
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [direccionEntrega, setDireccionEntrega] = useState('');
  const [transportista, setTransportista] = useState('');
  const [telefonoTransporte, setTelefonoTransporte] = useState('');
  const [direccionTransporte, setDireccionTransporte] = useState('');
  const [condicionPago, setCondicionPago] = useState('');
  const [notas, setNotas] = useState('');
  const [lineas, setLineas] = useState<LineaPedido[]>([]);

  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await fetch('/api/pedidos');
        const pedidos: Pedido[] = await res.json();
        const encontrado = pedidos.find((p) => p.id === id) || null;
        setPedido(encontrado);
        if (encontrado) {
          setFechaEntrega(encontrado.fecha_entrega || '');
          setDireccionEntrega(encontrado.direccion_entrega || '');
          setTransportista(encontrado.transportista || '');
          setTelefonoTransporte(encontrado.telefono_transporte || '');
          setDireccionTransporte(encontrado.direccion_transporte || '');
          setCondicionPago(encontrado.condicion_pago || '');
          setNotas(encontrado.notas || '');
          setLineas((encontrado.lineas || []).map(l => ({ ...l })));
        }
      } catch {
        console.error('Error cargando pedido');
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [id]);

  const recalcular = (l: LineaPedido): LineaPedido => {
    const desc = Math.max(0, Math.min(100, l.descuento_porcentaje || 0));
    const bonif = +(l.precio_unitario * (1 - desc / 100)).toFixed(2);
    return {
      ...l,
      descuento_porcentaje: desc,
      precio_bonificado: bonif,
      subtotal: +(l.cantidad * bonif).toFixed(2),
    };
  };

  const actualizarLinea = (i: number, campo: keyof LineaPedido, valor: string) => {
    setLineas((prev) => {
      const nuevas = [...prev];
      const linea = { ...nuevas[i] };
      if (campo === 'cantidad') linea.cantidad = Number(valor) || 0;
      else if (campo === 'cajas') linea.cajas = Number(valor) || 0;
      else if (campo === 'kg_aprox') linea.kg_aprox = Number(valor) || 0;
      else if (campo === 'precio_unitario') linea.precio_unitario = Number(valor) || 0;
      else if (campo === 'descuento_porcentaje') linea.descuento_porcentaje = Number(valor) || 0;
      nuevas[i] = recalcular(linea);
      return nuevas;
    });
  };

  const total = lineas.reduce((s, l) => s + (l.subtotal || 0), 0);

  const guardar = async () => {
    if (!pedido) return;
    setGuardando(true);
    try {
      const cambios: Partial<Pedido> = {
        fecha_entrega: fechaEntrega,
        direccion_entrega: direccionEntrega,
        transportista,
        telefono_transporte: telefonoTransporte,
        direccion_transporte: direccionTransporte,
        condicion_pago: condicionPago,
        notas,
        lineas,
        total,
      };
      const res = await fetch('/api/pedidos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, cambios }),
      });
      const data = await res.json();
      if (data.ok) {
        setPedido({ ...pedido, ...cambios } as Pedido);
        setEditando(false);
      } else {
        alert('Error al guardar: ' + (data.error || ''));
      }
    } catch {
      alert('Error de conexión');
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (nuevoEstado: EstadoPedido) => {
    if (!pedido) return;
    setGuardando(true);
    try {
      const res = await fetch('/api/pedidos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado: nuevoEstado }),
      });
      const data = await res.json();
      if (data.ok) {
        setPedido({ ...pedido, estado: nuevoEstado });
      } else {
        alert('Error al cambiar estado');
      }
    } catch {
      alert('Error de conexión');
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

  if (!pedido) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Pedido no encontrado</h2>
        <Link href="/gestion/pedidos" className="text-verde-oscuro hover:underline">Volver</Link>
      </div>
    );
  }

  const estadoConfig: Record<EstadoPedido, { label: string; color: string }> = {
    pendiente: { label: 'Pendiente', color: 'bg-amarillo-claro text-amber-800' },
    aprobado: { label: 'Aprobado', color: 'bg-verde-ok-claro text-verde-ok' },
    enviado: { label: 'Enviado', color: 'bg-blue-100 text-blue-800' },
  };
  const siguienteEstado: Record<EstadoPedido, EstadoPedido | null> = {
    pendiente: 'aprobado',
    aprobado: 'enviado',
    enviado: null,
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
        <div>
          <h2 className="text-2xl font-bold text-verde-oscuro">Pedido {pedido.numero}</h2>
          <p className="text-gray-500 text-sm">
            Creado el {formatDate(pedido.fecha_pedido)} por {pedido.vendedor_nombre}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${(estadoConfig[pedido.estado] || estadoConfig.pendiente).color}`}>
            {(estadoConfig[pedido.estado] || estadoConfig.pendiente).label}
          </span>
          {siguienteEstado[pedido.estado] && !editando && (
            <button
              onClick={() => cambiarEstado(siguienteEstado[pedido.estado]!)}
              disabled={guardando}
              className="bg-verde-oscuro text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-verde-claro disabled:opacity-50"
            >
              → {estadoConfig[siguienteEstado[pedido.estado]!].label}
            </button>
          )}
          {!editando && (
            <button
              onClick={() => setEditando(true)}
              className="bg-amarillo text-amber-900 px-3 py-1.5 rounded text-xs font-medium hover:bg-amber-400"
            >
              Editar
            </button>
          )}
        </div>
      </div>

      {/* Datos del cliente */}
      <section className="bg-white rounded-xl shadow-sm border p-5">
        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-3">Cliente y entrega</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">Cliente:</span> <span className="ml-2 font-medium text-gray-800">{pedido.cliente_razon_social}</span></div>
          <div><span className="text-gray-500">Teléfono:</span> <span className="ml-2 font-medium text-gray-800">{pedido.cliente_telefono || '—'}</span></div>

          <div>
            <span className="text-gray-500">Fecha entrega:</span>{' '}
            {editando ? (
              <input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)}
                className="ml-2 px-2 py-1 border rounded text-sm text-gray-800" />
            ) : <span className="ml-2 font-medium text-gray-800">{formatDate(pedido.fecha_entrega)}</span>}
          </div>
          <div>
            <span className="text-gray-500">Condición pago:</span>{' '}
            {editando ? (
              <input type="text" value={condicionPago} onChange={(e) => setCondicionPago(e.target.value)}
                className="ml-2 px-2 py-1 border rounded text-sm text-gray-800" />
            ) : <span className="ml-2 font-medium text-gray-800">{pedido.condicion_pago || '—'}</span>}
          </div>

          <div className="md:col-span-2">
            <span className="text-gray-500">Dirección entrega:</span>{' '}
            {editando ? (
              <input type="text" value={direccionEntrega} onChange={(e) => setDireccionEntrega(e.target.value)}
                className="ml-2 w-full mt-1 px-2 py-1 border rounded text-sm text-gray-800" />
            ) : <span className="ml-2 font-medium text-gray-800">{pedido.direccion_entrega}</span>}
          </div>

          <div>
            <span className="text-gray-500">Transporte:</span>{' '}
            {editando ? (
              <input type="text" value={transportista} onChange={(e) => setTransportista(e.target.value)}
                className="ml-2 px-2 py-1 border rounded text-sm text-gray-800" />
            ) : <span className="ml-2 font-medium text-gray-800">{pedido.transportista || '—'}</span>}
          </div>
          <div>
            <span className="text-gray-500">Tel. transporte:</span>{' '}
            {editando ? (
              <input type="text" value={telefonoTransporte} onChange={(e) => setTelefonoTransporte(e.target.value)}
                className="ml-2 px-2 py-1 border rounded text-sm text-gray-800" />
            ) : <span className="ml-2 font-medium text-gray-800">{pedido.telefono_transporte || '—'}</span>}
          </div>
          <div className="md:col-span-2">
            <span className="text-gray-500">Dir. transporte:</span>{' '}
            {editando ? (
              <input type="text" value={direccionTransporte} onChange={(e) => setDireccionTransporte(e.target.value)}
                className="ml-2 w-full mt-1 px-2 py-1 border rounded text-sm text-gray-800" />
            ) : <span className="ml-2 font-medium text-gray-800">{pedido.direccion_transporte || '—'}</span>}
          </div>
        </div>
      </section>

      {/* Detalle de productos */}
      <section className="bg-white rounded-xl shadow-sm border p-5">
        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-3">Detalle de productos</h3>
        {(lineas.length === 0) ? (
          <p className="text-gray-500 text-sm py-4 text-center">Este pedido no tiene líneas cargadas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs">
                  <th className="text-left px-2 py-2">Código</th>
                  <th className="text-left px-2 py-2">Producto</th>
                  <th className="text-right px-2 py-2 w-16">Cajas</th>
                  <th className="text-right px-2 py-2 w-20">Cantidad</th>
                  <th className="text-right px-2 py-2 w-20">Kg aprox</th>
                  <th className="text-right px-2 py-2 w-24">Precio</th>
                  <th className="text-right px-2 py-2 w-16">Desc %</th>
                  <th className="text-right px-2 py-2 w-28">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lineas.map((l, i) => (
                  <tr key={i}>
                    <td className="px-2 py-2 font-mono text-xs text-gray-500">{l.codigo}</td>
                    <td className="px-2 py-2 text-gray-800">{l.descripcion}</td>
                    <td className="px-2 py-2 text-right">
                      {editando ? (
                        <input type="number" min="0" value={l.cajas || ''}
                          onChange={(e) => actualizarLinea(i, 'cajas', e.target.value)}
                          className="w-16 px-1 py-1 border rounded text-right text-xs text-gray-800" />
                      ) : (l.cajas || '—')}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {editando ? (
                        <input type="number" min="0" value={l.cantidad || ''}
                          onChange={(e) => actualizarLinea(i, 'cantidad', e.target.value)}
                          className="w-20 px-1 py-1 border rounded text-right text-xs text-gray-800" />
                      ) : l.cantidad}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {editando ? (
                        <input type="number" min="0" step="0.1" value={l.kg_aprox || ''}
                          onChange={(e) => actualizarLinea(i, 'kg_aprox', e.target.value)}
                          className="w-20 px-1 py-1 border rounded text-right text-xs text-gray-800" />
                      ) : (l.kg_aprox ? `${l.kg_aprox} kg` : '—')}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {editando ? (
                        <input type="number" min="0" step="0.01" value={l.precio_unitario || ''}
                          onChange={(e) => actualizarLinea(i, 'precio_unitario', e.target.value)}
                          className="w-24 px-1 py-1 border rounded text-right text-xs text-gray-800" />
                      ) : formatCurrency(l.precio_unitario)}
                      {l.precio_lista > l.precio_unitario && (
                        <span className="block text-[10px] text-amber-600">Lista: {formatCurrency(l.precio_lista)}</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {editando ? (
                        <input type="number" min="0" max="100" step="0.5" value={l.descuento_porcentaje || ''}
                          onChange={(e) => actualizarLinea(i, 'descuento_porcentaje', e.target.value)}
                          className="w-14 px-1 py-1 border rounded text-right text-xs text-gray-800" />
                      ) : (l.descuento_porcentaje ? `${l.descuento_porcentaje}%` : '—')}
                    </td>
                    <td className="px-2 py-2 text-right font-medium text-gray-800">{formatCurrency(l.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td colSpan={7} className="px-2 py-3 text-right text-gray-800">Total:</td>
                  <td className="px-2 py-3 text-right text-verde-oscuro text-lg">{formatCurrency(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Alertas */}
      {pedido.alertas && pedido.alertas.length > 0 && (
        <section className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-3">Alertas</h3>
          <div className="space-y-2">
            {pedido.alertas.map((a, i) => (
              <div key={i} className={`px-3 py-2 rounded-lg text-sm ${a.nivel === 'error' ? 'bg-rojo-claro text-rojo' : 'bg-amarillo-claro text-amber-800'}`}>
                {a.nivel === 'error' ? '✗' : '⚠'} {a.mensaje}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Notas */}
      <section className="bg-white rounded-xl shadow-sm border p-5">
        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-3">Observaciones</h3>
        {editando ? (
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3}
            className="w-full px-3 py-2 border rounded-lg text-sm text-gray-800" />
        ) : (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{pedido.notas || '—'}</p>
        )}
      </section>

      {/* Acciones */}
      <div className="flex justify-between items-center">
        <Link href="/gestion/pedidos" className="text-verde-oscuro hover:underline text-sm font-medium">
          &larr; Volver a pedidos
        </Link>
        {editando && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditando(false);
                // Restaurar valores originales
                if (pedido) {
                  setFechaEntrega(pedido.fecha_entrega || '');
                  setDireccionEntrega(pedido.direccion_entrega || '');
                  setTransportista(pedido.transportista || '');
                  setTelefonoTransporte(pedido.telefono_transporte || '');
                  setDireccionTransporte(pedido.direccion_transporte || '');
                  setCondicionPago(pedido.condicion_pago || '');
                  setNotas(pedido.notas || '');
                  setLineas((pedido.lineas || []).map(l => ({ ...l })));
                }
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700"
            >Cancelar</button>
            <button
              onClick={guardar}
              disabled={guardando}
              className="px-4 py-2 bg-verde-oscuro text-white rounded-lg text-sm font-medium hover:bg-verde-claro disabled:opacity-50"
            >{guardando ? 'Guardando...' : 'Guardar cambios'}</button>
          </div>
        )}
      </div>
    </div>
  );
}
