'use client';

import { useState, useEffect, useMemo } from 'react';
import { Pedido, Vendedor, EstadoPedido } from '@/types';
import { formatCurrency, formatDate } from '@/lib/format';

/**
 * Vista principal del módulo Expedición.
 * Muestra los pedidos listos para despachar, AGRUPADOS POR CLIENTE.
 * Por cada cliente, se listan los productos sumarizados (unidades totales,
 * cajas, kg) agregados de todos sus pedidos aprobados / enviados.
 *
 * Filtros:
 *   - Vendedor (para quien solo despacha los suyos)
 *   - Estado (aprobado / enviado / todos)
 *
 * Botón Imprimir → layout optimizado para impresión.
 */
type EstadoFiltro = 'aprobado' | 'enviado' | 'aprobado_enviado' | 'todos';

interface ProductoAgregado {
  codigo: string;
  descripcion: string;
  unidades: number;
  cajas: number;
  kg: number;
  subtotal: number;
}

interface ClienteDespacho {
  cliente_id: string;
  cliente_razon_social: string;
  direccion_entrega: string;
  vendedor_nombre: string;
  pedidos: Pedido[];
  productos: ProductoAgregado[];
  total_unidades: number;
  total_cajas: number;
  total_kg: number;
  total: number;
}

export default function ExpedicionPorCliente() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroVendedor, setFiltroVendedor] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<EstadoFiltro>('aprobado_enviado');
  const [clienteExpandido, setClienteExpandido] = useState<string | null>(null);

  useEffect(() => {
    const cargar = async () => {
      try {
        const [rp, rv] = await Promise.all([
          fetch('/api/pedidos'),
          fetch('/api/vendedores'),
        ]);
        setPedidos(await rp.json());
        setVendedores(await rv.json());
      } catch {
        console.error('Error cargando expedición');
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  const estadosActivos: EstadoPedido[] = useMemo(() => {
    if (filtroEstado === 'aprobado') return ['aprobado'];
    if (filtroEstado === 'enviado') return ['enviado'];
    if (filtroEstado === 'aprobado_enviado') return ['aprobado', 'enviado'];
    return ['pendiente', 'aprobado', 'enviado', 'en_produccion', 'entregado', 'finalizado'];
  }, [filtroEstado]);

  // Agrupar pedidos filtrados por cliente_id
  const porCliente = useMemo((): ClienteDespacho[] => {
    const filtrados = pedidos.filter(p => {
      if (!estadosActivos.includes(p.estado)) return false;
      if (filtroVendedor !== 'todos' && p.vendedor_id !== filtroVendedor) return false;
      return true;
    });

    const map = new Map<string, ClienteDespacho>();
    for (const p of filtrados) {
      const key = p.cliente_id || p.cliente_razon_social;
      let c = map.get(key);
      if (!c) {
        c = {
          cliente_id: p.cliente_id,
          cliente_razon_social: p.cliente_razon_social,
          direccion_entrega: p.direccion_entrega || '',
          vendedor_nombre: p.vendedor_nombre,
          pedidos: [],
          productos: [],
          total_unidades: 0,
          total_cajas: 0,
          total_kg: 0,
          total: 0,
        };
        map.set(key, c);
      }
      c.pedidos.push(p);
      // última dirección disponible (los pedidos más nuevos tienen prioridad si difiere)
      if (p.direccion_entrega) c.direccion_entrega = p.direccion_entrega;
      // agregar líneas a productos agregados
      for (const l of p.lineas || []) {
        if (!l.producto_id && !l.codigo) continue;
        const pkey = l.producto_id || l.codigo;
        let agr = c.productos.find(x => (x.codigo === l.codigo && x.descripcion === l.descripcion) || pkey === l.producto_id);
        if (!agr) {
          agr = { codigo: l.codigo || '', descripcion: l.descripcion || '', unidades: 0, cajas: 0, kg: 0, subtotal: 0 };
          c.productos.push(agr);
        }
        agr.unidades += l.cantidad || 0;
        agr.cajas += l.cajas || 0;
        agr.kg += l.kg_aprox || 0;
        agr.subtotal += l.subtotal || 0;
      }
      c.total += p.total || 0;
    }

    // Totales por cliente
    for (const c of map.values()) {
      c.total_unidades = c.productos.reduce((s, p) => s + p.unidades, 0);
      c.total_cajas = c.productos.reduce((s, p) => s + p.cajas, 0);
      c.total_kg = c.productos.reduce((s, p) => s + p.kg, 0);
      c.productos.sort((a, b) => a.descripcion.localeCompare(b.descripcion));
    }

    return [...map.values()].sort((a, b) => a.cliente_razon_social.localeCompare(b.cliente_razon_social));
  }, [pedidos, estadosActivos, filtroVendedor]);

  const vendedoresOrdenados = useMemo(
    () => [...vendedores].filter(v => !v.rol).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [vendedores]
  );

  const totalGeneral = {
    clientes: porCliente.length,
    pedidos: porCliente.reduce((s, c) => s + c.pedidos.length, 0),
    unidades: porCliente.reduce((s, c) => s + c.total_unidades, 0),
    cajas: porCliente.reduce((s, c) => s + c.total_cajas, 0),
    kg: porCliente.reduce((s, c) => s + c.total_kg, 0),
    total: porCliente.reduce((s, c) => s + c.total, 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-verde-oscuro border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros + acciones */}
      <div className="bg-white rounded-xl border p-4 space-y-3 no-print">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Estado:</label>
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as EstadoFiltro)}
              className="px-3 py-1.5 border rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-verde-oscuro outline-none">
              <option value="aprobado_enviado">Aprobados + Enviados (por despachar)</option>
              <option value="aprobado">Sólo Aprobados</option>
              <option value="enviado">Sólo Enviados</option>
              <option value="todos">Todos los estados</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Vendedor:</label>
            <select value={filtroVendedor} onChange={(e) => setFiltroVendedor(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-verde-oscuro outline-none">
              <option value="todos">Todos</option>
              {vendedoresOrdenados.map(v => (
                <option key={v.id} value={v.id}>{v.nombre}</option>
              ))}
            </select>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => window.print()}
            className="px-4 py-1.5 border border-verde-oscuro text-verde-oscuro rounded-lg text-sm font-medium hover:bg-verde-oscuro hover:text-white transition-colors"
          >
            🖨 Imprimir
          </button>
        </div>
      </div>

      {/* Totales generales */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Clientes" value={totalGeneral.clientes} />
        <StatCard label="Pedidos" value={totalGeneral.pedidos} />
        <StatCard label="Unidades" value={totalGeneral.unidades} />
        <StatCard label="Cajas" value={totalGeneral.cajas.toFixed(1)} />
        <StatCard label="Kg" value={totalGeneral.kg.toFixed(1)} />
      </div>

      {/* Título impresión */}
      <div className="hidden print:block text-center mb-4">
        <h1 className="text-xl font-bold">Hoja de Expedición — {formatDate(new Date().toISOString().slice(0, 10))}</h1>
        <p className="text-sm text-gray-600">
          {filtroVendedor !== 'todos' && `Vendedor: ${vendedoresOrdenados.find(v => v.id === filtroVendedor)?.nombre} · `}
          {totalGeneral.clientes} clientes · {totalGeneral.unidades} unidades · {totalGeneral.kg.toFixed(1)} kg
        </p>
      </div>

      {/* Lista de clientes */}
      {porCliente.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-500">
          No hay pedidos para despachar con los filtros aplicados.
        </div>
      ) : (
        <div className="space-y-3">
          {porCliente.map(cd => {
            const expandido = clienteExpandido === cd.cliente_id;
            return (
              <div key={cd.cliente_id} className="bg-white rounded-xl border shadow-sm overflow-hidden print:break-inside-avoid">
                <button
                  onClick={() => setClienteExpandido(expandido ? null : cd.cliente_id)}
                  className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors flex items-start justify-between gap-4 no-print"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 text-base">{cd.cliente_razon_social}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {cd.direccion_entrega || 'Sin dirección'} · Vendedor: {cd.vendedor_nombre}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-sm flex-shrink-0">
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Pedidos</div>
                      <div className="font-bold text-gray-800">{cd.pedidos.length}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Unidades</div>
                      <div className="font-bold text-verde-oscuro">{cd.total_unidades}</div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-gray-500">Kg</div>
                      <div className="font-bold text-gray-800">{cd.total_kg.toFixed(1)}</div>
                    </div>
                    <div className="text-right hidden md:block">
                      <div className="text-xs text-gray-500">Total</div>
                      <div className="font-bold text-gray-800">{formatCurrency(cd.total)}</div>
                    </div>
                    <svg className={`w-5 h-5 text-gray-400 transition-transform ${expandido ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Print view: siempre expandido */}
                <div className="hidden print:block px-5 py-3 border-b">
                  <h3 className="font-bold text-base">{cd.cliente_razon_social}</h3>
                  <p className="text-xs text-gray-600">{cd.direccion_entrega} · {cd.vendedor_nombre}</p>
                </div>

                {(expandido || typeof window !== 'undefined') && (
                  <div className={`${expandido ? 'block' : 'hidden'} print:block border-t px-5 py-4 space-y-3`}>
                    {/* Tabla productos agregados */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-gray-600 text-xs">
                            <th className="text-left px-3 py-2 font-medium">Producto</th>
                            <th className="text-left px-3 py-2 font-medium w-20">Código</th>
                            <th className="text-right px-3 py-2 font-medium w-24">Unidades</th>
                            <th className="text-right px-3 py-2 font-medium w-20">Cajas</th>
                            <th className="text-right px-3 py-2 font-medium w-24">Kg aprox</th>
                            <th className="text-right px-3 py-2 font-medium w-28 no-print">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {cd.productos.map((p, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2 text-gray-800">{p.descripcion}</td>
                              <td className="px-3 py-2 font-mono text-xs text-gray-500">{p.codigo}</td>
                              <td className="px-3 py-2 text-right font-semibold text-verde-oscuro">{p.unidades}</td>
                              <td className="px-3 py-2 text-right text-gray-700">{p.cajas.toFixed(2)}</td>
                              <td className="px-3 py-2 text-right text-gray-700">{p.kg.toFixed(2)}</td>
                              <td className="px-3 py-2 text-right text-gray-700 no-print">{formatCurrency(p.subtotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50 font-semibold">
                            <td colSpan={2} className="px-3 py-2 text-right text-xs text-gray-600">Total:</td>
                            <td className="px-3 py-2 text-right text-verde-oscuro">{cd.total_unidades}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{cd.total_cajas.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{cd.total_kg.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right text-gray-800 no-print">{formatCurrency(cd.total)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Pedidos que componen */}
                    <div className="border-t pt-3 no-print">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Pedidos incluidos</h4>
                      <div className="space-y-1 text-xs">
                        {cd.pedidos.map(p => (
                          <div key={p.id} className="flex items-center justify-between text-gray-700 py-1 border-b last:border-b-0">
                            <span className="font-mono">{p.numero}</span>
                            <span>{formatDate(p.fecha_pedido)}</span>
                            <span className="capitalize">{p.estado.replace('_', ' ')}</span>
                            <span className="font-medium">{formatCurrency(p.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border p-3 text-center">
      <div className="text-xl font-bold text-gray-800">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
