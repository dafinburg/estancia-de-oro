'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Cliente, Producto, ListaPrecio, LineaPedido, ResultadoValidacion, AlertaPedido } from '@/types';
import { formatCurrency } from '@/lib/format';
import PanelValidaciones from './PanelValidaciones';

// Formulario de pedido — basado en el template real "NOTA DE PEDIDO"
// Secciones: Datos, Cliente, Transporte, Productos (con cajas/kg), Notas
export default function FormularioPedido({ redirectBase = '/pedidos' }: { redirectBase?: string }) {
  const { vendedor } = useAuth();
  const router = useRouter();

  // --- Datos maestros ---
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [listaPrecio, setListaPrecio] = useState<ListaPrecio | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  // --- Estados del formulario ---
  const [clienteId, setClienteId] = useState('');
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [fechaPedido, setFechaPedido] = useState(() => new Date().toISOString().split('T')[0]);
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [transportista, setTransportista] = useState('');
  const [direccionTransporte, setDireccionTransporte] = useState('');
  const [telefonoTransporte, setTelefonoTransporte] = useState('');
  const [direccionEntrega, setDireccionEntrega] = useState('');
  const [notas, setNotas] = useState('');
  const [lineas, setLineas] = useState<LineaPedido[]>([crearLineaVacia()]);

  // --- UI ---
  const [validaciones, setValidaciones] = useState<ResultadoValidacion[]>([]);
  const [mostrarValidaciones, setMostrarValidaciones] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [saldoConfirmado, setSaldoConfirmado] = useState(false);
  const [modalSaldo, setModalSaldo] = useState(false);

  const clienteSeleccionado = clientes.find((c) => c.id === clienteId);

  function crearLineaVacia(): LineaPedido {
    return {
      producto_id: '',
      codigo: '',
      descripcion: '',
      unidades_por_caja: 1,
      cajas: 0,
      cantidad: 0,
      kg_aprox: 0,
      precio_unitario: 0,
      precio_lista: 0,
      precio_bonificado: 0,
      subtotal: 0,
    };
  }

  // Cargar datos iniciales
  useEffect(() => {
    if (!vendedor) return;
    const cargar = async () => {
      try {
        const [resClientes, resProductos, resLista] = await Promise.all([
          fetch(`/api/clientes?ids=${vendedor.clientes.join(',')}`),
          fetch('/api/productos'),
          fetch(`/api/listas-precio?id=${vendedor.lista_precio_id}`),
        ]);
        setClientes(await resClientes.json());
        setProductos(await resProductos.json());
        setListaPrecio(await resLista.json());
      } catch (err) {
        console.error('Error cargando datos:', err);
      } finally {
        setLoadingData(false);
      }
    };
    cargar();
  }, [vendedor]);

  // Al cambiar cliente: precargar datos
  useEffect(() => {
    if (clienteSeleccionado) {
      setDireccionEntrega(clienteSeleccionado.direccion);
      setSaldoConfirmado(false);
      // Si el cliente tiene lista propia diferente, cargarla
      if (clienteSeleccionado.lista_precio_id && clienteSeleccionado.lista_precio_id !== listaPrecio?.id) {
        fetch(`/api/listas-precio?id=${clienteSeleccionado.lista_precio_id}`)
          .then(r => r.json())
          .then(d => {
            setListaPrecio(d);
            // Recalcular precios en líneas existentes
            setLineas(prev => prev.map(l => {
              if (!l.producto_id) return l;
              const precioItem = d.precios?.find((p: {producto_id: string; precio: number}) => p.producto_id === l.producto_id);
              const precioLista = precioItem?.precio || 0;
              return {
                ...l,
                precio_lista: precioLista,
                precio_unitario: precioLista,
                precio_bonificado: precioLista,
                subtotal: l.cantidad * precioLista,
              };
            }));
          })
          .catch(() => {});
      }
    }
  }, [clienteId, clienteSeleccionado, listaPrecio?.id]);

  const getPrecioLista = useCallback((productoId: string): number => {
    if (!listaPrecio) return 0;
    return listaPrecio.precios.find((p) => p.producto_id === productoId)?.precio || 0;
  }, [listaPrecio]);

  // Actualizar una línea
  const actualizarLinea = (index: number, campo: keyof LineaPedido, valor: string | number) => {
    setLineas((prev) => {
      const nuevas = [...prev];
      const linea = { ...nuevas[index] };

      if (campo === 'producto_id') {
        const producto = productos.find((p) => p.id === valor);
        if (producto) {
          linea.producto_id = producto.id;
          linea.codigo = producto.codigo;
          linea.descripcion = producto.descripcion;
          linea.unidades_por_caja = producto.unidades_por_caja || 1;
          linea.precio_lista = getPrecioLista(producto.id);
          linea.precio_unitario = linea.precio_lista;
          linea.precio_bonificado = linea.precio_lista;
          linea.cantidad = linea.cajas * linea.unidades_por_caja;
          linea.subtotal = linea.cantidad * linea.precio_unitario;
        }
      } else if (campo === 'cajas') {
        linea.cajas = Number(valor) || 0;
        linea.cantidad = linea.cajas * linea.unidades_por_caja;
        linea.subtotal = linea.cantidad * linea.precio_unitario;
      } else if (campo === 'cantidad') {
        linea.cantidad = Number(valor) || 0;
        // Si cambia unidades manualmente, no tocar cajas
        linea.subtotal = linea.cantidad * linea.precio_unitario;
      } else if (campo === 'kg_aprox') {
        linea.kg_aprox = Number(valor) || 0;
      } else if (campo === 'precio_unitario') {
        linea.precio_unitario = Number(valor) || 0;
        linea.precio_bonificado = linea.precio_unitario;
        linea.subtotal = linea.cantidad * linea.precio_unitario;
      }

      nuevas[index] = linea;
      return nuevas;
    });
  };

  const agregarLinea = () => setLineas((prev) => [...prev, crearLineaVacia()]);
  const eliminarLinea = (index: number) => {
    if (lineas.length <= 1) return;
    setLineas((prev) => prev.filter((_, i) => i !== index));
  };

  const total = lineas.reduce((sum, l) => sum + l.subtotal, 0);
  const totalCajas = lineas.reduce((sum, l) => sum + l.cajas, 0);
  const totalUnidades = lineas.reduce((sum, l) => sum + l.cantidad, 0);
  const totalKg = lineas.reduce((sum, l) => sum + l.kg_aprox, 0);

  // Filtrar clientes por búsqueda (razón social o CUIT)
  const clientesFiltrados = useMemo(() => {
    if (!busquedaCliente.trim()) return clientes.slice(0, 100); // mostrar primeros 100 por defecto
    const q = busquedaCliente.toLowerCase();
    return clientes.filter(c =>
      c.razon_social.toLowerCase().includes(q) ||
      c.cuit?.includes(q) ||
      c.nombre_fantasia?.toLowerCase().includes(q) ||
      c.localidad?.toLowerCase().includes(q)
    ).slice(0, 100);
  }, [clientes, busquedaCliente]);

  // Agrupar productos por categoría para el selector
  const productosPorCategoria = useMemo(() => {
    const grupos: Record<string, Producto[]> = {};
    productos.forEach(p => {
      const cat = p.categoria || 'OTROS';
      if (!grupos[cat]) grupos[cat] = [];
      grupos[cat].push(p);
    });
    return grupos;
  }, [productos]);

  // --- Validaciones ---
  const ejecutarValidaciones = useCallback((): ResultadoValidacion[] => {
    const res: ResultadoValidacion[] = [];
    if (!clienteId) {
      res.push({ campo: 'Cliente', estado: 'error', mensaje: 'Debés seleccionar un cliente' });
    } else {
      res.push({ campo: 'Cliente', estado: 'ok', mensaje: 'Cliente seleccionado correctamente' });
    }
    if (!fechaEntrega) {
      res.push({ campo: 'Fecha de entrega', estado: 'error', mensaje: 'Debés indicar una fecha de entrega' });
    } else {
      res.push({ campo: 'Fecha de entrega', estado: 'ok', mensaje: 'Fecha de entrega indicada' });
    }
    const validas = lineas.filter((l) => l.producto_id && l.cantidad > 0);
    if (validas.length === 0) {
      res.push({ campo: 'Productos', estado: 'error', mensaje: 'Agregá al menos un producto con cantidad > 0' });
    } else {
      res.push({ campo: 'Productos', estado: 'ok', mensaje: `${validas.length} producto(s) agregado(s)` });
    }
    lineas.forEach((l) => {
      if (!l.producto_id || l.cantidad === 0) return;
      if (l.precio_unitario <= 0) {
        res.push({ campo: `Precio — ${l.descripcion}`, estado: 'error', mensaje: 'El precio no puede ser 0 o negativo' });
      } else if (l.precio_unitario < l.precio_lista) {
        const dif = l.precio_lista - l.precio_unitario;
        res.push({
          campo: `Precio — ${l.descripcion}`,
          estado: 'warning',
          mensaje: `Precio ${formatCurrency(dif)} por debajo de lista (${formatCurrency(l.precio_lista)})`,
        });
      }
    });
    if (clienteSeleccionado) {
      const saldo = clienteSeleccionado.saldo_cuenta_corriente;
      if (saldo < -50000) {
        res.push({
          campo: 'Saldo cuenta corriente',
          estado: 'error',
          mensaje: `Cliente con deuda de ${formatCurrency(Math.abs(saldo))} — excede el límite de $50.000. Requiere autorización.`,
        });
      } else if (saldo < 0) {
        res.push({
          campo: 'Saldo cuenta corriente',
          estado: 'warning',
          mensaje: saldoConfirmado
            ? `Cliente con saldo vencido de ${formatCurrency(Math.abs(saldo))} — vendedor confirmó continuar`
            : `Cliente con saldo vencido de ${formatCurrency(Math.abs(saldo))} — confirmar para continuar`,
        });
      } else {
        res.push({ campo: 'Saldo cuenta corriente', estado: 'ok', mensaje: 'Sin deuda pendiente' });
      }
    }
    return res;
  }, [clienteId, fechaEntrega, lineas, clienteSeleccionado, saldoConfirmado]);

  useEffect(() => {
    if (mostrarValidaciones) setValidaciones(ejecutarValidaciones());
  }, [mostrarValidaciones, ejecutarValidaciones]);

  const puedeEnviar = (): boolean => {
    const vals = ejecutarValidaciones();
    if (vals.some((v) => v.estado === 'error')) return false;
    const saldoW = vals.find((v) => v.campo === 'Saldo cuenta corriente' && v.estado === 'warning');
    if (saldoW && !saldoConfirmado && clienteSeleccionado &&
        clienteSeleccionado.saldo_cuenta_corriente < 0 &&
        clienteSeleccionado.saldo_cuenta_corriente >= -50000) {
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    setMostrarValidaciones(true);
    const vals = ejecutarValidaciones();
    setValidaciones(vals);

    if (clienteSeleccionado &&
        clienteSeleccionado.saldo_cuenta_corriente < 0 &&
        clienteSeleccionado.saldo_cuenta_corriente >= -50000 &&
        !saldoConfirmado) {
      setModalSaldo(true);
      return;
    }
    if (!puedeEnviar()) return;

    setEnviando(true);
    try {
      const alertas: AlertaPedido[] = [];
      lineas.forEach((l) => {
        if (l.producto_id && l.cantidad > 0 && l.precio_unitario < l.precio_lista) {
          alertas.push({
            tipo: 'precio_bajo',
            mensaje: `${l.descripcion}: precio ${formatCurrency(l.precio_unitario)} vs lista ${formatCurrency(l.precio_lista)}`,
            nivel: 'warning',
          });
        }
      });
      if (clienteSeleccionado && clienteSeleccionado.saldo_cuenta_corriente < 0) {
        alertas.push({
          tipo: 'saldo_vencido',
          mensaje: `Saldo vencido: ${formatCurrency(Math.abs(clienteSeleccionado.saldo_cuenta_corriente))}`,
          nivel: 'warning',
        });
      }

      const lineasValidas = lineas.filter((l) => l.producto_id && l.cantidad > 0);
      const pedidoData = {
        vendedor_id: vendedor!.id,
        vendedor_nombre: vendedor!.nombre,
        cliente_id: clienteId,
        cliente_razon_social: clienteSeleccionado!.razon_social,
        cliente_telefono: clienteSeleccionado!.telefono || '',
        fecha_pedido: fechaPedido,
        fecha_entrega: fechaEntrega,
        condicion_pago: clienteSeleccionado!.condicion_pago,
        transportista,
        direccion_transporte: direccionTransporte,
        telefono_transporte: telefonoTransporte,
        direccion_entrega: direccionEntrega,
        lineas: lineasValidas,
        total,
        estado: 'pendiente' as const,
        notas: saldoConfirmado
          ? `${notas}\n[NOTA AUTOMÁTICA: Vendedor continuó con saldo vencido de ${formatCurrency(Math.abs(clienteSeleccionado!.saldo_cuenta_corriente))}]`.trim()
          : notas,
        alertas,
      };

      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pedidoData),
      });
      const data = await res.json();
      if (data.ok) {
        router.push(`${redirectBase}/${data.pedido.id}?nuevo=true`);
      } else {
        alert('Error al guardar el pedido');
      }
    } catch {
      alert('Error de conexión');
    } finally {
      setEnviando(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-verde-oscuro border-t-transparent rounded-full" />
        <span className="ml-3 text-gray-500">Cargando datos...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <h2 className="text-2xl font-bold text-verde-oscuro">Nueva Nota de Pedido</h2>

      {/* Datos del pedido */}
      <section className="bg-white rounded-xl shadow-sm border p-5 space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Datos del pedido</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input type="date" value={fechaPedido} onChange={(e) => setFechaPedido(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-verde-oscuro outline-none text-gray-800" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de entrega <span className="text-rojo">*</span>
            </label>
            <input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)}
              min={fechaPedido}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-verde-oscuro outline-none text-gray-800 ${
                mostrarValidaciones && !fechaEntrega ? 'border-rojo' : ''
              }`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendedor</label>
            <input type="text" value={vendedor?.nombre || ''} disabled
              className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-600" />
          </div>
        </div>
      </section>

      {/* Cliente */}
      <section className="bg-white rounded-xl shadow-sm border p-5 space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Cliente</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Buscar cliente (razón social / CUIT / localidad)
          </label>
          <input type="text" value={busquedaCliente} onChange={(e) => setBusquedaCliente(e.target.value)}
            placeholder="Escribí para filtrar..."
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-verde-oscuro outline-none mb-2 text-gray-800" />
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Seleccionar cliente <span className="text-rojo">*</span> ({clientesFiltrados.length} de {clientes.length})
          </label>
          <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-verde-oscuro outline-none text-gray-800 ${
              mostrarValidaciones && !clienteId ? 'border-rojo' : ''
            }`}>
            <option value="">— Seleccionar cliente —</option>
            {clientesFiltrados.map((c) => (
              <option key={c.id} value={c.id}>
                {c.razon_social}{c.localidad ? ` — ${c.localidad}` : ''}
              </option>
            ))}
          </select>
        </div>

        {clienteSeleccionado && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 rounded-lg p-4 text-sm">
            <div><span className="text-gray-500">Razón social:</span> <span className="font-medium text-gray-800">{clienteSeleccionado.razon_social}</span></div>
            <div><span className="text-gray-500">CUIT:</span> <span className="font-medium text-gray-800">{clienteSeleccionado.cuit || '—'}</span></div>
            <div><span className="text-gray-500">Teléfono:</span> <span className="font-medium text-gray-800">{clienteSeleccionado.telefono || '—'}</span></div>
            <div><span className="text-gray-500">Localidad:</span> <span className="font-medium text-gray-800">{clienteSeleccionado.localidad || '—'}, {clienteSeleccionado.provincia || ''}</span></div>
            <div className="md:col-span-2"><span className="text-gray-500">Dirección:</span> <span className="font-medium text-gray-800">{clienteSeleccionado.direccion}</span></div>
            <div><span className="text-gray-500">Condición de pago:</span> <span className="font-medium text-gray-800">{clienteSeleccionado.condicion_pago}</span></div>
            <div>
              <span className="text-gray-500">Saldo CC:</span>
              <span className={`ml-2 font-bold ${
                clienteSeleccionado.saldo_cuenta_corriente < -50000 ? 'text-rojo' :
                clienteSeleccionado.saldo_cuenta_corriente < 0 ? 'text-amber-600' : 'text-verde-ok'
              }`}>
                {formatCurrency(clienteSeleccionado.saldo_cuenta_corriente)}
              </span>
              {clienteSeleccionado.saldo_cuenta_corriente < -50000 && (
                <span className="ml-2 text-xs bg-rojo text-white px-2 py-0.5 rounded-full">BLOQUEADO</span>
              )}
              {clienteSeleccionado.saldo_cuenta_corriente < 0 && clienteSeleccionado.saldo_cuenta_corriente >= -50000 && (
                <span className="ml-2 text-xs bg-amarillo text-amber-900 px-2 py-0.5 rounded-full">Saldo vencido</span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Transporte */}
      <section className="bg-white rounded-xl shadow-sm border p-5 space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Transporte / Re-despacho</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del transporte</label>
            <input type="text" value={transportista} onChange={(e) => setTransportista(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-verde-oscuro outline-none text-gray-800"
              placeholder="Nombre del transporte" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono transporte (con prefijo)</label>
            <input type="text" value={telefonoTransporte} onChange={(e) => setTelefonoTransporte(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-verde-oscuro outline-none text-gray-800"
              placeholder="Ej: 0381-4123456" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección del transporte de re-despacho</label>
            <input type="text" value={direccionTransporte} onChange={(e) => setDireccionTransporte(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-verde-oscuro outline-none text-gray-800"
              placeholder="Dirección de la terminal / transporte" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección de entrega del pedido</label>
            <input type="text" value={direccionEntrega} onChange={(e) => setDireccionEntrega(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-verde-oscuro outline-none text-gray-800" />
          </div>
        </div>
      </section>

      {/* Productos */}
      <section className="bg-white rounded-xl shadow-sm border p-5 space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Productos por líneas</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs">
                <th className="text-left px-2 py-2 font-medium w-20">Código</th>
                <th className="text-left px-2 py-2 font-medium">Producto</th>
                <th className="text-right px-2 py-2 font-medium w-16">U/Caja</th>
                <th className="text-right px-2 py-2 font-medium w-16">Cajas</th>
                <th className="text-right px-2 py-2 font-medium w-20">Unidades</th>
                <th className="text-right px-2 py-2 font-medium w-20">Kg aprox</th>
                <th className="text-right px-2 py-2 font-medium w-24">$ x Kg/U</th>
                <th className="text-right px-2 py-2 font-medium w-28">Subtotal</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lineas.map((linea, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-2 py-2 font-mono text-xs text-gray-600">{linea.codigo || '—'}</td>
                  <td className="px-2 py-2">
                    <select value={linea.producto_id} onChange={(e) => actualizarLinea(index, 'producto_id', e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-xs focus:ring-2 focus:ring-verde-oscuro outline-none text-gray-800">
                      <option value="">— Seleccionar —</option>
                      {Object.entries(productosPorCategoria).map(([cat, prods]) => (
                        <optgroup key={cat} label={cat}>
                          {prods.map((p) => (
                            <option key={p.id} value={p.id}>{p.descripcion}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2 text-right text-gray-600 text-xs">{linea.unidades_por_caja}</td>
                  <td className="px-2 py-2">
                    <input type="number" min="0" value={linea.cajas || ''}
                      onChange={(e) => actualizarLinea(index, 'cajas', e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-right text-xs focus:ring-2 focus:ring-verde-oscuro outline-none text-gray-800" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" min="0" value={linea.cantidad || ''}
                      onChange={(e) => actualizarLinea(index, 'cantidad', e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-right text-xs focus:ring-2 focus:ring-verde-oscuro outline-none text-gray-800" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" min="0" step="0.1" value={linea.kg_aprox || ''}
                      onChange={(e) => actualizarLinea(index, 'kg_aprox', e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-right text-xs focus:ring-2 focus:ring-verde-oscuro outline-none text-gray-800" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" min="0" step="0.01" value={linea.precio_unitario || ''}
                      onChange={(e) => actualizarLinea(index, 'precio_unitario', e.target.value)}
                      className={`w-full px-2 py-1.5 border rounded text-right text-xs focus:ring-2 focus:ring-verde-oscuro outline-none text-gray-800 ${
                        linea.producto_id && linea.precio_unitario > 0 && linea.precio_unitario < linea.precio_lista
                          ? 'border-amarillo bg-amarillo-claro'
                          : linea.producto_id && linea.precio_unitario <= 0 && linea.cantidad > 0
                          ? 'border-rojo bg-rojo-claro' : ''
                      }`} />
                    {linea.producto_id && linea.precio_unitario > 0 && linea.precio_unitario < linea.precio_lista && (
                      <span className="block text-[10px] text-amber-600 mt-0.5">Lista: {formatCurrency(linea.precio_lista)}</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right font-medium text-gray-800 text-xs">
                    {linea.subtotal > 0 ? formatCurrency(linea.subtotal) : '—'}
                  </td>
                  <td className="px-2 py-2">
                    <button onClick={() => eliminarLinea(index)} disabled={lineas.length <= 1}
                      className="text-rojo hover:text-red-800 disabled:opacity-30 disabled:cursor-not-allowed p-1" title="Eliminar línea">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold text-gray-700">
                <td colSpan={3} className="px-2 py-2 text-right text-xs">Totales:</td>
                <td className="px-2 py-2 text-right text-xs">{totalCajas}</td>
                <td className="px-2 py-2 text-right text-xs">{totalUnidades}</td>
                <td className="px-2 py-2 text-right text-xs">{totalKg.toFixed(1)} kg</td>
                <td></td>
                <td className="px-2 py-2 text-right text-verde-oscuro text-sm">{formatCurrency(total)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button onClick={agregarLinea} className="flex items-center gap-1 text-verde-oscuro hover:text-verde-claro font-medium text-sm transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Agregar producto
          </button>
          <div className="text-right">
            <span className="text-gray-500 text-sm">Total del pedido:</span>
            <p className="text-2xl font-bold text-verde-oscuro">{formatCurrency(total)}</p>
          </div>
        </div>
      </section>

      {/* Notas */}
      <section className="bg-white rounded-xl shadow-sm border p-5 space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Observaciones</h3>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-verde-oscuro outline-none resize-none text-gray-800"
          placeholder="Observaciones o notas para este pedido..." />
      </section>

      {mostrarValidaciones && (
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Resumen de validaciones</h3>
          <PanelValidaciones validaciones={validaciones} />
        </section>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-end no-print">
        <button
          onClick={() => { setMostrarValidaciones(true); setValidaciones(ejecutarValidaciones()); }}
          className="px-6 py-2.5 border-2 border-verde-oscuro text-verde-oscuro rounded-lg font-medium hover:bg-verde-oscuro hover:text-white transition-colors"
        >Validar pedido</button>
        <button
          onClick={handleSubmit} disabled={enviando}
          className="px-6 py-2.5 bg-verde-oscuro text-white rounded-lg font-medium hover:bg-verde-claro transition-colors disabled:opacity-50"
        >{enviando ? 'Guardando...' : 'Confirmar pedido'}</button>
      </div>

      {modalSaldo && clienteSeleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-amarillo-claro rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">⚠</span>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Saldo vencido</h3>
              <p className="text-gray-600 mb-4">
                El cliente <strong>{clienteSeleccionado.razon_social}</strong> tiene un saldo vencido
                de <strong className="text-rojo">{formatCurrency(Math.abs(clienteSeleccionado.saldo_cuenta_corriente))}</strong>.
              </p>
              <p className="text-sm text-gray-500 mb-6">Si continuás, se generará una nota automática en el pedido.</p>
              <div className="flex gap-3">
                <button onClick={() => setModalSaldo(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium">Cancelar</button>
                <button onClick={() => {
                  setSaldoConfirmado(true);
                  setModalSaldo(false);
                  setTimeout(() => handleSubmit(), 100);
                }}
                  className="flex-1 px-4 py-2 bg-amarillo text-amber-900 rounded-lg font-medium hover:bg-amber-400">
                  Continuar de todos modos
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
