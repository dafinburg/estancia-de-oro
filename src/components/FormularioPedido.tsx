'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Cliente, Producto, ListaPrecio, LineaPedido, AlertaPedido, Pedido } from '@/types';
import { formatCurrency } from '@/lib/format';
import { estadoCuentaDe, estadoLabel } from '@/lib/cliente';

/**
 * Nueva Nota de Pedido — versión simplificada.
 *
 * Cambios vs versión anterior:
 *   - Sin fecha de entrega (lo resuelve admin)
 *   - Sin sección de transporte (lo resuelve admin)
 *   - Cliente con combobox de typeahead
 *   - Dirección de entrega en la sección Cliente, autocargada del maestro
 *   - Tabla de productos manejada por UNIDADES (input principal) →
 *     cajas y kg se calculan automáticamente
 *   - "Precio especial" opcional en vez de % de descuento; si se usa,
 *     genera alerta para el aprobador
 *   - Un solo botón "Confirmar pedido"; validación inline con bordes rojos
 */
export default function FormularioPedido({ redirectBase = '/pedidos' }: { redirectBase?: string }) {
  const { vendedor } = useAuth();
  const router = useRouter();

  // --- Datos maestros ---
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [listaPrecio, setListaPrecio] = useState<ListaPrecio | null>(null);
  const [pedidosVendedor, setPedidosVendedor] = useState<Pedido[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // --- Estado del formulario ---
  const [clienteId, setClienteId] = useState('');
  const [fechaPedido, setFechaPedido] = useState(() => new Date().toISOString().split('T')[0]);
  const [direccionEntrega, setDireccionEntrega] = useState('');
  const [notas, setNotas] = useState('');
  const [lineas, setLineas] = useState<LineaPedido[]>([crearLineaVacia()]);

  // --- UI ---
  const [enviando, setEnviando] = useState(false);
  const [saldoConfirmado, setSaldoConfirmado] = useState(false);
  const [modalSaldo, setModalSaldo] = useState(false);
  const [mostrarErrores, setMostrarErrores] = useState(false);

  // --- Cliente combobox ---
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [comboAbierto, setComboAbierto] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  const clienteSeleccionado = clientes.find((c) => c.id === clienteId);

  // Pedidos del cliente que todavia no estan finalizados (= en circuito)
  const pedidosPendientesCliente = useMemo(() => {
    if (!clienteId) return [];
    return pedidosVendedor.filter(p => p.cliente_id === clienteId && p.estado !== 'finalizado');
  }, [pedidosVendedor, clienteId]);
  const estadoCliente = clienteSeleccionado ? estadoCuentaDe(clienteSeleccionado) : null;
  const clienteBloqueado = estadoCliente === 'bloqueado';

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
      descuento_porcentaje: 0,
      subtotal: 0,
    };
  }

  // Recalcula cajas (derivada) y kg (derivada) a partir de unidades.
  // Subtotal = unidades × precio_unitario.
  function recalcular(l: LineaPedido, producto?: Producto): LineaPedido {
    const upc = Math.max(1, l.unidades_por_caja || 1);
    const cajas = l.cantidad > 0 ? +(l.cantidad / upc).toFixed(2) : 0;
    const pesoProm = producto?.peso_promedio_kg ?? 0;
    const kg = pesoProm > 0 ? +(l.cantidad * pesoProm).toFixed(2) : l.kg_aprox;
    // Subtotal: si hay kg (sea derivado del peso o cargado a mano), el precio
    // se interpreta como $/kg. Si no hay kg, fallback a precio por unidad.
    const subtotal = kg > 0
      ? +(kg * l.precio_unitario).toFixed(2)
      : +(l.cantidad * l.precio_unitario).toFixed(2);
    return {
      ...l,
      cajas,
      kg_aprox: kg,
      precio_bonificado: l.precio_unitario, // sin descuento
      descuento_porcentaje: 0,
      subtotal,
    };
  }

  // Cerrar combo al click fuera
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!comboRef.current) return;
      if (!comboRef.current.contains(e.target as Node)) setComboAbierto(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Cargar datos iniciales
  useEffect(() => {
    if (!vendedor) return;
    const cargar = async () => {
      try {
        const [resClientes, resProductos, resLista, resPedidos] = await Promise.all([
          fetch(`/api/clientes?ids=${vendedor.clientes.join(',')}`),
          fetch('/api/productos'),
          fetch(`/api/listas-precio?id=${vendedor.lista_precio_id}`),
          fetch(`/api/pedidos?vendedor_id=${vendedor.id}`),
        ]);
        setClientes(await resClientes.json());
        setProductos(await resProductos.json());
        setListaPrecio(await resLista.json());
        setPedidosVendedor(await resPedidos.json());
      } catch (err) {
        console.error('Error cargando datos:', err);
      } finally {
        setLoadingData(false);
      }
    };
    cargar();
  }, [vendedor]);

  // Al cambiar cliente: precargar direccion entrega
  useEffect(() => {
    if (clienteSeleccionado) {
      setDireccionEntrega(clienteSeleccionado.direccion);
      setSaldoConfirmado(false);
      // Si el cliente tiene lista propia diferente, cargarla y recalcular precios
      if (clienteSeleccionado.lista_precio_id && clienteSeleccionado.lista_precio_id !== listaPrecio?.id) {
        fetch(`/api/listas-precio?id=${clienteSeleccionado.lista_precio_id}`)
          .then(r => r.json())
          .then(d => {
            setListaPrecio(d);
            setLineas(prev => prev.map(l => {
              if (!l.producto_id) return l;
              const precioItem = d.precios?.find((p: {producto_id: string; precio: number}) => p.producto_id === l.producto_id);
              const precioLista = precioItem?.precio || 0;
              const prod = productos.find(p => p.id === l.producto_id);
              return recalcular({ ...l, precio_lista: precioLista, precio_unitario: precioLista }, prod);
            }));
          })
          .catch(() => {});
      }
    }
  }, [clienteId, clienteSeleccionado, listaPrecio?.id, productos]);

  const getPrecioLista = useCallback((productoId: string): number => {
    if (!listaPrecio) return 0;
    return listaPrecio.precios.find((p) => p.producto_id === productoId)?.precio || 0;
  }, [listaPrecio]);

  // --- Actualizar línea ---
  const actualizarLinea = (index: number, campo: keyof LineaPedido, valor: string | number) => {
    setLineas((prev) => {
      const nuevas = [...prev];
      const linea = { ...nuevas[index] };
      let productoRef: Producto | undefined;

      if (campo === 'producto_id') {
        const producto = productos.find((p) => p.id === valor);
        if (producto) {
          productoRef = producto;
          linea.producto_id = producto.id;
          linea.codigo = producto.codigo;
          linea.descripcion = producto.descripcion;
          linea.unidades_por_caja = producto.unidades_por_caja || 1;
          linea.precio_lista = getPrecioLista(producto.id);
          linea.precio_unitario = linea.precio_lista;
        }
      } else if (campo === 'cantidad') {
        linea.cantidad = Number(valor) || 0;
      } else if (campo === 'precio_unitario') {
        linea.precio_unitario = Number(valor) || 0;
      } else if (campo === 'kg_aprox') {
        // Sólo editable si el producto no tiene peso_promedio_kg cargado
        linea.kg_aprox = Number(valor) || 0;
      }

      const prod = productoRef || productos.find(p => p.id === linea.producto_id);
      nuevas[index] = recalcular(linea, prod);
      return nuevas;
    });
  };

  const agregarLinea = () => setLineas((prev) => [...prev, crearLineaVacia()]);
  const eliminarLinea = (index: number) => {
    if (lineas.length <= 1) return;
    setLineas((prev) => prev.filter((_, i) => i !== index));
  };

  const total = lineas.reduce((sum, l) => sum + l.subtotal, 0);
  const totalUnidades = lineas.reduce((sum, l) => sum + l.cantidad, 0);
  const totalCajas = lineas.reduce((sum, l) => sum + l.cajas, 0);
  const totalKg = lineas.reduce((sum, l) => sum + l.kg_aprox, 0);

  // Clientes filtrados para el combobox
  const clientesFiltrados = useMemo(() => {
    const q = busquedaCliente.toLowerCase().trim();
    if (!q) return clientes.slice(0, 50);
    return clientes.filter(c =>
      c.razon_social.toLowerCase().includes(q) ||
      c.cuit?.includes(q) ||
      c.nombre_fantasia?.toLowerCase().includes(q) ||
      c.localidad?.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [clientes, busquedaCliente]);

  // Agrupar productos por categoría
  const productosPorCategoria = useMemo(() => {
    const grupos: Record<string, Producto[]> = {};
    productos.forEach(p => {
      const cat = p.categoria || 'OTROS';
      if (!grupos[cat]) grupos[cat] = [];
      grupos[cat].push(p);
    });
    return grupos;
  }, [productos]);

  // --- Validaciones inline ---
  const errores = useMemo(() => {
    const e: Record<string, string> = {};
    if (!clienteId) e.cliente = 'Seleccioná un cliente';
    if (!direccionEntrega.trim()) e.direccion = 'Indicá la dirección de entrega';
    const validas = lineas.filter(l => l.producto_id && l.cantidad > 0);
    if (validas.length === 0) e.productos = 'Agregá al menos un producto con unidades';
    lineas.forEach((l, i) => {
      if (!l.producto_id) return;
      if (l.cantidad <= 0) e[`linea_${i}_unidades`] = 'Unidades debe ser > 0';
      if (l.precio_unitario <= 0) e[`linea_${i}_precio`] = 'Precio debe ser > 0';
    });
    return e;
  }, [clienteId, direccionEntrega, lineas]);

  const tieneErrores = Object.keys(errores).length > 0;
  const err = (k: string): string | undefined => mostrarErrores ? errores[k] : undefined;

  const handleSubmit = async () => {
    setMostrarErrores(true);
    if (tieneErrores) return;
    if (clienteBloqueado) return;

    if (estadoCliente === 'observado' && !saldoConfirmado) {
      setModalSaldo(true);
      return;
    }

    setEnviando(true);
    try {
      const alertas: AlertaPedido[] = [];
      lineas.forEach((l) => {
        if (l.producto_id && l.cantidad > 0 && l.precio_unitario !== l.precio_lista && l.precio_lista > 0) {
          const dif = l.precio_lista - l.precio_unitario;
          const signo = dif > 0 ? 'menor' : 'mayor';
          alertas.push({
            tipo: 'precio_bajo',
            mensaje: `${l.descripcion}: precio especial ${formatCurrency(l.precio_unitario)} (${formatCurrency(Math.abs(dif))} ${signo} que lista ${formatCurrency(l.precio_lista)})`,
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
        fecha_entrega: '', // lo completa admin
        condicion_pago: clienteSeleccionado!.condicion_pago,
        transportista: '',
        direccion_transporte: '',
        telefono_transporte: '',
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

  const seleccionarCliente = (c: Cliente) => {
    setClienteId(c.id);
    setBusquedaCliente(c.razon_social);
    setComboAbierto(false);
  };
  const limpiarCliente = () => {
    setClienteId('');
    setBusquedaCliente('');
    setDireccionEntrega('');
    setComboAbierto(true);
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input type="date" value={fechaPedido} onChange={(e) => setFechaPedido(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-verde-oscuro outline-none text-gray-800" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendedor</label>
            <input type="text" value={vendedor?.nombre || ''} disabled
              className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-600" />
          </div>
        </div>
      </section>

      {/* Cliente + dirección de entrega */}
      <section className="bg-white rounded-xl shadow-sm border p-5 space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Cliente</h3>

        {/* Combobox cliente */}
        <div ref={comboRef} className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Buscar cliente <span className="text-rojo">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={busquedaCliente}
              onChange={(e) => { setBusquedaCliente(e.target.value); setComboAbierto(true); if (clienteId) setClienteId(''); }}
              onFocus={() => setComboAbierto(true)}
              placeholder="Razón social, CUIT, localidad..."
              className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-verde-oscuro outline-none text-gray-800 ${
                err('cliente') ? 'border-rojo' : ''
              }`}
            />
            {clienteId && (
              <button type="button" onClick={limpiarCliente}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1"
                title="Limpiar">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {err('cliente') && <p className="text-xs text-rojo mt-1">{err('cliente')}</p>}

          {comboAbierto && !clienteId && (
            <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-80 overflow-y-auto">
              {clientesFiltrados.length === 0 ? (
                <div className="px-3 py-4 text-sm text-gray-500 text-center">Sin resultados</div>
              ) : (
                clientesFiltrados.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => seleccionarCliente(c)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b last:border-b-0 text-sm"
                  >
                    <div className="font-medium text-gray-800">{c.razon_social}</div>
                    <div className="text-xs text-gray-500">
                      {c.cuit || '—'}{c.localidad ? ` · ${c.localidad}` : ''}{c.provincia ? `, ${c.provincia}` : ''}
                    </div>
                  </button>
                ))
              )}
              {clientes.length > clientesFiltrados.length && (
                <div className="px-3 py-2 text-xs text-gray-400 bg-gray-50 border-t">
                  Mostrando {clientesFiltrados.length} de {clientes.length} — afiná la búsqueda
                </div>
              )}
            </div>
          )}
        </div>

        {/* Banner estado cliente */}
        {clienteSeleccionado && estadoCliente === 'bloqueado' && (
          <div className="bg-rojo-claro border-2 border-rojo rounded-lg p-4 flex items-start gap-3">
            <span className="text-2xl">🚫</span>
            <div className="flex-1">
              <p className="font-bold text-rojo">Cliente bloqueado</p>
              <p className="text-sm text-red-800 mt-1">
                No se puede generar el pedido. <strong>Hablar con administración para aprobar.</strong>
              </p>
            </div>
          </div>
        )}
        {clienteSeleccionado && estadoCliente === 'observado' && (
          <div className="bg-amarillo-claro border-2 border-amarillo rounded-lg p-4 flex items-start gap-3">
            <span className="text-2xl">⚠</span>
            <div className="flex-1">
              <p className="font-bold text-amber-900">Cliente observado</p>
              <p className="text-sm text-amber-800 mt-1">
                Tiene saldo pendiente. Podés avanzar, se deja nota automática.
              </p>
            </div>
          </div>
        )}
        {clienteSeleccionado && estadoCliente === 'al_dia' && (
          <div className="bg-verde-ok-claro border border-verde-ok/40 rounded-lg px-4 py-2 text-sm text-verde-ok font-medium">
            ✓ Cliente {estadoLabel[estadoCliente]} — podés avanzar con el pedido.
          </div>
        )}

        {/* Resumen rapido de la situacion del cliente */}
        {clienteSeleccionado && (() => {
          const saldo = clienteSeleccionado.saldo_cuenta_corriente;
          const debe = saldo < 0; // saldo negativo = debe al cliente
          const cantPendientes = pedidosPendientesCliente.length;
          const sinNada = !debe && cantPendientes === 0;
          const color = sinNada
            ? 'bg-verde-ok-claro border-verde-ok/40 text-verde-ok'
            : debe
              ? 'bg-rojo-claro border-rojo/40 text-rojo'
              : 'bg-amarillo-claro border-amarillo/40 text-amber-800';
          return (
            <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${color}`}>
              {sinNada ? (
                <>✓ Sin deuda y sin pedidos pendientes.</>
              ) : (
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  {debe ? (
                    <span>⚠ Debe <strong>{formatCurrency(Math.abs(saldo))}</strong></span>
                  ) : saldo > 0 ? (
                    <span>Saldo a favor: <strong>{formatCurrency(saldo)}</strong></span>
                  ) : (
                    <span>Sin deuda</span>
                  )}
                  {cantPendientes > 0 && (
                    <span>📦 <strong>{cantPendientes}</strong> pedido{cantPendientes === 1 ? '' : 's'} pendiente{cantPendientes === 1 ? '' : 's'} (sin finalizar)</span>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Datos del cliente + dirección de entrega editable */}
        {clienteSeleccionado && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 rounded-lg p-4 text-sm">
              <div><span className="text-gray-500">Razón social:</span> <span className="font-medium text-gray-800">{clienteSeleccionado.razon_social}</span></div>
              <div><span className="text-gray-500">CUIT:</span> <span className="font-medium text-gray-800">{clienteSeleccionado.cuit || '—'}</span></div>
              <div><span className="text-gray-500">Teléfono:</span> <span className="font-medium text-gray-800">{clienteSeleccionado.telefono || '—'}</span></div>
              <div><span className="text-gray-500">Localidad:</span> <span className="font-medium text-gray-800">{clienteSeleccionado.localidad || '—'}{clienteSeleccionado.provincia ? `, ${clienteSeleccionado.provincia}` : ''}</span></div>
              <div><span className="text-gray-500">Condición de pago:</span> <span className="font-medium text-gray-800">{clienteSeleccionado.condicion_pago}</span></div>
              <div>
                <span className="text-gray-500">Saldo CC:</span>
                <span className={`ml-2 font-bold ${
                  clienteSeleccionado.saldo_cuenta_corriente < -50000 ? 'text-rojo' :
                  clienteSeleccionado.saldo_cuenta_corriente < 0 ? 'text-amber-600' : 'text-verde-ok'
                }`}>
                  {formatCurrency(clienteSeleccionado.saldo_cuenta_corriente)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dirección de entrega <span className="text-rojo">*</span>
              </label>
              <input
                type="text"
                value={direccionEntrega}
                onChange={(e) => setDireccionEntrega(e.target.value)}
                placeholder="Se autocompleta con la dirección del cliente"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-verde-oscuro outline-none text-gray-800 ${
                  err('direccion') ? 'border-rojo' : ''
                }`}
              />
              {err('direccion') && <p className="text-xs text-rojo mt-1">{err('direccion')}</p>}
            </div>
          </>
        )}
      </section>

      {/* Productos */}
      <section className="bg-white rounded-xl shadow-sm border p-5 space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Productos</h3>
        {err('productos') && <p className="text-sm text-rojo bg-rojo-claro px-3 py-2 rounded">{err('productos')}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs">
                <th className="text-left px-2 py-2 font-medium">Producto</th>
                <th className="text-right px-2 py-2 font-medium w-28 text-verde-oscuro">Unidades *</th>
                <th className="text-right px-2 py-2 font-medium w-20">Cajas</th>
                <th className="text-right px-2 py-2 font-medium w-24">Kg aprox</th>
                <th className="text-right px-2 py-2 font-medium w-28">$ x Kg/U</th>
                <th className="text-right px-2 py-2 font-medium w-28">Subtotal</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lineas.map((linea, index) => {
                const prod = productos.find(p => p.id === linea.producto_id);
                const tienePesoProm = !!(prod?.peso_promedio_kg && prod.peso_promedio_kg > 0);
                const precioEspecial = linea.producto_id && linea.precio_unitario > 0 && linea.precio_lista > 0 && linea.precio_unitario !== linea.precio_lista;
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    {/* Producto */}
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
                      {linea.codigo && <span className="block text-[10px] text-gray-500 mt-0.5 font-mono">{linea.codigo}</span>}
                    </td>

                    {/* Unidades (principal, más grande) */}
                    <td className="px-2 py-2">
                      <input
                        type="number" min="0" step="1" value={linea.cantidad || ''}
                        onChange={(e) => actualizarLinea(index, 'cantidad', e.target.value)}
                        className={`w-full px-2 py-2 border-2 rounded text-right text-base font-semibold focus:ring-2 focus:ring-verde-oscuro outline-none text-gray-900 ${
                          err(`linea_${index}_unidades`) ? 'border-rojo' : linea.producto_id ? 'border-verde-oscuro' : 'border-gray-300'
                        }`}
                      />
                    </td>

                    {/* Cajas (derivado) */}
                    <td className="px-2 py-2 text-right text-xs text-gray-600">
                      {linea.producto_id ? (
                        <>
                          <div className="font-medium">{linea.cajas}</div>
                          <div className="text-[10px] text-gray-400">({linea.unidades_por_caja}/caja)</div>
                        </>
                      ) : '—'}
                    </td>

                    {/* Kg (auto si hay peso_promedio_kg, si no editable) */}
                    <td className="px-2 py-2">
                      {tienePesoProm ? (
                        <div className="text-right text-xs text-gray-700">
                          <div className="font-medium">{linea.kg_aprox.toFixed(2)}</div>
                          <div className="text-[10px] text-gray-400">({prod?.peso_promedio_kg} kg/u)</div>
                        </div>
                      ) : (
                        <input type="number" min="0" step="0.1" value={linea.kg_aprox || ''}
                          onChange={(e) => actualizarLinea(index, 'kg_aprox', e.target.value)}
                          className="w-full px-2 py-1.5 border rounded text-right text-xs focus:ring-2 focus:ring-verde-oscuro outline-none text-gray-800" />
                      )}
                    </td>

                    {/* Precio (con posibilidad de "precio especial") */}
                    <td className="px-2 py-2">
                      <input type="number" min="0" step="0.01" value={linea.precio_unitario || ''}
                        onChange={(e) => actualizarLinea(index, 'precio_unitario', e.target.value)}
                        className={`w-full px-2 py-1.5 border rounded text-right text-xs focus:ring-2 focus:ring-verde-oscuro outline-none text-gray-800 ${
                          err(`linea_${index}_precio`) ? 'border-rojo bg-rojo-claro' :
                          precioEspecial ? 'border-amarillo bg-amarillo-claro' : ''
                        }`} />
                      {precioEspecial && (
                        <span className="block text-[10px] text-amber-700 mt-0.5">
                          Precio especial · lista {formatCurrency(linea.precio_lista)}
                        </span>
                      )}
                    </td>

                    {/* Subtotal */}
                    <td className="px-2 py-2 text-right font-medium text-gray-800 text-xs">
                      {linea.subtotal > 0 ? formatCurrency(linea.subtotal) : '—'}
                    </td>

                    {/* Eliminar */}
                    <td className="px-2 py-2">
                      <button onClick={() => eliminarLinea(index)} disabled={lineas.length <= 1}
                        className="text-rojo hover:text-red-800 disabled:opacity-30 disabled:cursor-not-allowed p-1" title="Eliminar línea">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold text-gray-700">
                <td className="px-2 py-2 text-right text-xs">Totales:</td>
                <td className="px-2 py-2 text-right text-sm text-verde-oscuro">{totalUnidades}</td>
                <td className="px-2 py-2 text-right text-xs">{totalCajas.toFixed(2)}</td>
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
            <span className="text-gray-500 text-sm">Total:</span>
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

      {/* Confirmar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
        <div>
          {mostrarErrores && tieneErrores && (
            <p className="text-sm text-rojo font-medium">
              Revisá los campos marcados en rojo
            </p>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={enviando || clienteBloqueado}
          title={clienteBloqueado ? 'Cliente bloqueado' : ''}
          className="px-8 py-3 bg-verde-oscuro text-white rounded-lg font-semibold hover:bg-verde-claro transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base shadow-sm"
        >
          {enviando ? 'Guardando...' : clienteBloqueado ? 'Cliente bloqueado' : 'Confirmar pedido'}
        </button>
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
