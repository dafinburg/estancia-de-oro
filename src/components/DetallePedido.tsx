'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Pedido, EstadoPedido } from '@/types';
import { formatCurrency, formatDate } from '@/lib/format';
import Link from 'next/link';

// Componente de detalle de un pedido
// Muestra toda la información y permite imprimir/exportar a PDF
export default function DetallePedido({ backHref = '/vendedor', newHref = '/vendedor/nuevo' }: { backHref?: string; newHref?: string }) {
  const params = useParams();
  const searchParams = useSearchParams();
  const esNuevo = searchParams.get('nuevo') === 'true';

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      try {
        // Buscar el pedido en todos los pedidos
        const res = await fetch('/api/pedidos');
        const pedidos: Pedido[] = await res.json();
        const encontrado = pedidos.find((p) => p.id === params.id);
        setPedido(encontrado || null);
      } catch {
        console.error('Error cargando pedido');
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [params.id]);

  const estadoConfig: Record<EstadoPedido, { label: string; color: string }> = {
    pendiente: { label: 'Pendiente', color: 'bg-amarillo-claro text-amber-800' },
    aprobado: { label: 'Aprobado', color: 'bg-verde-ok-claro text-verde-ok' },
    enviado: { label: 'Enviado', color: 'bg-blue-100 text-blue-800' },
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
        <Link href={backHref} className="text-verde-oscuro hover:underline">Volver a mis pedidos</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 print-container">
      {/* Mensaje de éxito para pedido recién creado */}
      {esNuevo && (
        <div className="bg-verde-ok-claro border border-verde-ok/30 rounded-xl p-4 flex items-center gap-3 no-print">
          <span className="text-2xl">✓</span>
          <div>
            <p className="font-bold text-verde-ok">Pedido creado exitosamente</p>
            <p className="text-sm text-green-700">N. de pedido: {pedido.numero}</p>
          </div>
        </div>
      )}

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold text-verde-oscuro">Pedido {pedido.numero}</h2>
          <p className="text-gray-500 text-sm mt-1">
            Creado el {formatDate(pedido.fecha_pedido)} por {pedido.vendedor_nombre}
          </p>
        </div>
        <div className="flex items-center gap-3 no-print">
          <span className={`px-4 py-1.5 rounded-full text-sm font-medium ${(estadoConfig[pedido.estado] || estadoConfig.pendiente).color}`}>
            {(estadoConfig[pedido.estado] || estadoConfig.pendiente).label}
          </span>
          <button
            onClick={() => window.print()}
            className="px-4 py-1.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors text-gray-700"
          >
            Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Datos del cliente */}
      <section className="bg-white rounded-xl shadow-sm border p-5">
        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Datos del cliente y entrega</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">Cliente:</span> <span className="ml-2 font-medium text-gray-800">{pedido.cliente_razon_social}</span></div>
          <div><span className="text-gray-500">Teléfono cliente:</span> <span className="ml-2 font-medium text-gray-800">{pedido.cliente_telefono || '—'}</span></div>
          <div><span className="text-gray-500">Fecha entrega:</span> <span className="ml-2 font-medium text-gray-800">{formatDate(pedido.fecha_entrega)}</span></div>
          <div><span className="text-gray-500">Condición pago:</span> <span className="ml-2 font-medium text-gray-800">{pedido.condicion_pago || '—'}</span></div>
          <div className="md:col-span-2"><span className="text-gray-500">Dirección de entrega:</span> <span className="ml-2 font-medium text-gray-800">{pedido.direccion_entrega}</span></div>
          <div><span className="text-gray-500">Transporte:</span> <span className="ml-2 font-medium text-gray-800">{pedido.transportista || '—'}</span></div>
          <div><span className="text-gray-500">Teléfono transporte:</span> <span className="ml-2 font-medium text-gray-800">{pedido.telefono_transporte || '—'}</span></div>
          {pedido.direccion_transporte && (
            <div className="md:col-span-2"><span className="text-gray-500">Dirección transporte re-despacho:</span> <span className="ml-2 font-medium text-gray-800">{pedido.direccion_transporte}</span></div>
          )}
        </div>
      </section>

      {/* Detalle de productos */}
      <section className="bg-white rounded-xl shadow-sm border p-5">
        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Detalle de productos</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs">
                <th className="text-left px-3 py-2 font-medium">Código</th>
                <th className="text-left px-3 py-2 font-medium">Producto</th>
                <th className="text-right px-3 py-2 font-medium">Cajas</th>
                <th className="text-right px-3 py-2 font-medium">Unidades</th>
                <th className="text-right px-3 py-2 font-medium">Kg aprox</th>
                <th className="text-right px-3 py-2 font-medium">Precio</th>
                <th className="text-right px-3 py-2 font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pedido.lineas.map((linea, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">{linea.codigo}</td>
                  <td className="px-3 py-2 text-gray-800">{linea.descripcion}</td>
                  <td className="px-3 py-2 text-right text-gray-800">{linea.cajas || '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-800">{linea.cantidad}</td>
                  <td className="px-3 py-2 text-right text-gray-800">{linea.kg_aprox ? `${linea.kg_aprox} kg` : '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-800">
                    {formatCurrency(linea.precio_unitario)}
                    {linea.precio_unitario < linea.precio_lista && (
                      <span className="block text-xs text-amber-600">Lista: {formatCurrency(linea.precio_lista)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-gray-800">{formatCurrency(linea.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-bold">
                <td colSpan={6} className="px-3 py-3 text-right text-gray-800">Total:</td>
                <td className="px-3 py-3 text-right text-verde-oscuro text-lg">{formatCurrency(pedido.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Alertas del pedido */}
      {pedido.alertas && pedido.alertas.length > 0 && (
        <section className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Alertas</h3>
          <div className="space-y-2">
            {pedido.alertas.map((alerta, i) => (
              <div
                key={i}
                className={`px-4 py-3 rounded-lg text-sm ${
                  alerta.nivel === 'error'
                    ? 'bg-rojo-claro text-rojo'
                    : 'bg-amarillo-claro text-amber-800'
                }`}
              >
                {alerta.nivel === 'error' ? '✗' : '⚠'} {alerta.mensaje}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Notas */}
      {pedido.notas && (
        <section className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Observaciones</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{pedido.notas}</p>
        </section>
      )}

      {/* Navegación */}
      <div className="flex justify-between no-print">
        <Link href={backHref} className="text-verde-oscuro hover:underline text-sm font-medium">
          &larr; Volver a mis pedidos
        </Link>
        <Link href={newHref} className="bg-verde-oscuro text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-verde-claro transition-colors">
          Nuevo pedido
        </Link>
      </div>
    </div>
  );
}
