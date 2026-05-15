'use client';

import { useState, useEffect, useMemo } from 'react';
import { Pedido, EstadoPedido, Vendedor, Cliente } from '@/types';
import { formatDate } from '@/lib/format';

/**
 * Vista de expedición: pedidos listos para preparar.
 *
 * Pensada para el operario de depósito. Muestra los pedidos pendientes de
 * preparación (estados 'aprobado' y 'enviado' por defecto) agrupados por
 * vendedor o por zona, con sólo la información que necesita: cliente,
 * dirección de entrega, descripción de producto y unidades. Sin precios,
 * sin cajas, sin kg — los datos económicos no le importan al que arma.
 *
 * Tiene además un resumen de "total a preparar" por producto en el filtro
 * actual: cuántas unidades totales hay que sacar del depósito en este turno.
 */
type Agrupacion = 'vendedor' | 'zona' | 'cliente';
type EstadoFiltro = EstadoPedido | 'aprobado_enviado';

export default function PedidosParaPreparar() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState<EstadoFiltro>('aprobado_enviado');
  const [agrupacion, setAgrupacion] = useState<Agrupacion>('vendedor');
  const [filtroVendedor, setFiltroVendedor] = useState<string>('todos');
  const [filtroZona, setFiltroZona] = useState<string>('todas');

  useEffect(() => {
    Promise.all([
      fetch('/api/pedidos', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/vendedores').then(r => r.json()),
      fetch('/api/clientes?lite=1').then(r => r.json()),
    ]).then(([p, v, c]) => {
      setPedidos(p);
      setVendedores(v);
      setClientes(c);
    }).finally(() => setLoading(false));
  }, []);

  // Lookup cliente → zona
  const zonaDeCliente = useMemo(() => {
    const m: Record<string, string> = {};
    clientes.forEach(c => { if (c.id) m[c.id] = c.zona || 'Sin zona'; });
    return m;
  }, [clientes]);

  // Filtrar pedidos por estado + vendedor + zona
  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter(p => {
      if (estado === 'aprobado_enviado') {
        if (p.estado !== 'aprobado' && p.estado !== 'enviado') return false;
      } else if (p.estado !== estado) return false;
      if (filtroVendedor !== 'todos' && p.vendedor_id !== filtroVendedor) return false;
      if (filtroZona !== 'todas') {
        const z = zonaDeCliente[p.cliente_id] || 'Sin zona';
        if (z !== filtroZona) return false;
      }
      return true;
    });
  }, [pedidos, estado, filtroVendedor, filtroZona, zonaDeCliente]);

  // Total a preparar por producto en el filtro actual
  const totalesProducto = useMemo(() => {
    const m: Record<string, { descripcion: string; unidades: number }> = {};
    pedidosFiltrados.forEach(p => {
      (p.lineas || []).forEach(l => {
        const key = l.codigo || l.descripcion;
        if (!m[key]) m[key] = { descripcion: l.descripcion, unidades: 0 };
        m[key].unidades += Number(l.cantidad) || 0;
      });
    });
    return Object.entries(m)
      .map(([codigo, v]) => ({ codigo, ...v }))
      .sort((a, b) => b.unidades - a.unidades);
  }, [pedidosFiltrados]);

  // Agrupacion principal de pedidos
  const grupos = useMemo(() => {
    const m: Record<string, Pedido[]> = {};
    pedidosFiltrados.forEach(p => {
      let key: string;
      if (agrupacion === 'vendedor') key = p.vendedor_nombre || 'Sin vendedor';
      else if (agrupacion === 'zona') key = zonaDeCliente[p.cliente_id] || 'Sin zona';
      else key = p.cliente_razon_social;
      if (!m[key]) m[key] = [];
      m[key].push(p);
    });
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]));
  }, [pedidosFiltrados, agrupacion, zonaDeCliente]);

  const zonasUnicas = useMemo(() => {
    const s = new Set<string>();
    clientes.forEach(c => { if (c.zona) s.add(c.zona); });
    return Array.from(s).sort();
  }, [clientes]);

  const vendedoresOrdenados = useMemo(
    () => vendedores.filter(v => !v.rol).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [vendedores]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-verde-oscuro border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        <div>
          <h2 className="text-xl font-bold text-verde-oscuro">Pedidos para preparar</h2>
          <p className="text-xs text-gray-500">{pedidosFiltrados.length} pedidos · {totalesProducto.reduce((s, p) => s + p.unidades, 0)} unidades totales</p>
        </div>
        <button onClick={() => window.print()}
          className="bg-verde-oscuro text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-verde-claro">
          🖨 Imprimir
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border p-4 grid grid-cols-1 md:grid-cols-4 gap-3 no-print">
        <label className="text-sm">
          <span className="block text-gray-600 mb-1 font-medium">Estado</span>
          <select value={estado} onChange={e => setEstado(e.target.value as EstadoFiltro)}
            className="w-full px-3 py-2 border rounded-lg bg-white text-gray-800">
            <option value="aprobado_enviado">Aprobado + Enviado (default)</option>
            <option value="pendiente">Pendientes</option>
            <option value="aprobado">Sólo aprobados</option>
            <option value="enviado">Sólo enviados</option>
            <option value="en_produccion">En producción</option>
            <option value="entregado">Entregados</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-gray-600 mb-1 font-medium">Agrupar por</span>
          <select value={agrupacion} onChange={e => setAgrupacion(e.target.value as Agrupacion)}
            className="w-full px-3 py-2 border rounded-lg bg-white text-gray-800">
            <option value="vendedor">Vendedor</option>
            <option value="zona">Zona</option>
            <option value="cliente">Cliente</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-gray-600 mb-1 font-medium">Vendedor</span>
          <select value={filtroVendedor} onChange={e => setFiltroVendedor(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-white text-gray-800">
            <option value="todos">Todos</option>
            {vendedoresOrdenados.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-gray-600 mb-1 font-medium">Zona</span>
          <select value={filtroZona} onChange={e => setFiltroZona(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-white text-gray-800">
            <option value="todas">Todas</option>
            {zonasUnicas.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        </label>
      </div>

      {/* Cabecera para impresion */}
      <div className="hidden print:block border-b pb-2 mb-2">
        <h2 className="text-lg font-bold">Pedidos para preparar — {agrupacion === 'vendedor' ? 'por vendedor' : agrupacion === 'zona' ? 'por zona' : 'por cliente'}</h2>
        <p className="text-xs">
          {filtroVendedor !== 'todos' && <>Vendedor: {vendedores.find(v => v.id === filtroVendedor)?.nombre} · </>}
          {filtroZona !== 'todas' && <>Zona: {filtroZona} · </>}
          {pedidosFiltrados.length} pedidos · {totalesProducto.reduce((s, p) => s + p.unidades, 0)} unidades totales
        </p>
      </div>

      {/* Resumen de total a preparar */}
      {totalesProducto.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="bg-verde-ok-claro px-4 py-2 border-b">
            <h3 className="font-semibold text-verde-ok text-sm">📦 Total a preparar (depósito)</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/70 text-xs text-gray-500">
                <th className="text-left px-4 py-2">Código</th>
                <th className="text-left px-4 py-2">Producto</th>
                <th className="text-right px-4 py-2">Unidades</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {totalesProducto.map(p => (
                <tr key={p.codigo}>
                  <td className="px-4 py-1.5 font-mono text-xs text-gray-600">{p.codigo}</td>
                  <td className="px-4 py-1.5 text-gray-800">{p.descripcion}</td>
                  <td className="px-4 py-1.5 text-right font-bold text-gray-800">{p.unidades}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pedidos agrupados */}
      {grupos.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <p className="text-gray-500">No hay pedidos en el filtro actual</p>
        </div>
      ) : (
        grupos.map(([key, peds]) => (
          <section key={key} className="bg-white rounded-xl border overflow-hidden print-pedido">
            <div className="bg-gray-100 px-4 py-2 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">{key} <span className="text-gray-500 font-normal text-xs">({peds.length} pedido{peds.length === 1 ? '' : 's'})</span></h3>
            </div>
            <div className="divide-y">
              {peds.map(pedido => (
                <div key={pedido.id} className="p-4 print-pedido">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                    <div>
                      <p className="font-medium text-gray-800">{pedido.cliente_razon_social}</p>
                      <p className="text-xs text-gray-500">
                        {pedido.numero}
                        {' · '}{pedido.vendedor_nombre}
                        {pedido.fecha_entrega && <> · entrega {formatDate(pedido.fecha_entrega)}</>}
                        {zonaDeCliente[pedido.cliente_id] && <> · {zonaDeCliente[pedido.cliente_id]}</>}
                      </p>
                      {pedido.direccion_entrega && (
                        <p className="text-xs text-gray-500">📍 {pedido.direccion_entrega}</p>
                      )}
                    </div>
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-600 no-print">{pedido.estado}</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 bg-gray-50">
                        <th className="text-right px-2 py-1 w-20">Unidades</th>
                        <th className="text-left px-2 py-1">Producto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(pedido.lineas || []).map((l, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-2 py-1 text-right font-bold text-base">{l.cantidad}</td>
                          <td className="px-2 py-1 text-gray-800">{l.descripcion}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {pedido.notas && (
                    <p className="text-xs mt-2 text-gray-600 italic">Notas: {pedido.notas}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
