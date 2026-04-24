// Definición del schema completo de Baserow para Estancia de Oro.
// Se usa desde setup.mjs para crear las 16 tablas con sus campos.
//
// Tipos de Baserow que usamos:
//   text, long_text, number, boolean, date, single_select
//   Para single_select, `select_options` es el array de opciones.

/**
 * Estructura de cada tabla:
 * {
 *   name: 'nombre_tabla',
 *   fields: [
 *     { name, type, ...opts }
 *   ]
 * }
 *
 * El primer campo (sería el "primary field" de Baserow) siempre es el id textual
 * nuestro (p. ej. "id" = "c_001"). Baserow genera además un row_id interno que
 * NO usamos como FK.
 */

const number = (opts = {}) => ({ type: 'number', number_decimal_places: 0, ...opts });
const decimal = (places = 2) => ({ type: 'number', number_decimal_places: places });
const text = () => ({ type: 'text' });
const longText = () => ({ type: 'long_text' });
const bool = () => ({ type: 'boolean' });
const date = () => ({ type: 'date', date_format: 'ISO', date_include_time: false });
const datetime = () => ({ type: 'date', date_format: 'ISO', date_include_time: true });
const select = (options) => ({
  type: 'single_select',
  select_options: options.map((v, i) => ({ value: v, color: colors[i % colors.length] })),
});
const colors = ['light-blue', 'light-green', 'light-orange', 'light-red', 'light-gray', 'light-purple', 'light-pink', 'light-brown'];

export const SCHEMA = [
  // =========== MAESTROS ===========
  {
    name: 'vendedores',
    fields: [
      { name: 'id', ...text() },
      { name: 'nombre', ...text() },
      { name: 'usuario', ...text() },
      { name: 'password', ...text() },
      { name: 'region', ...text() },
      { name: 'lista_precio_id', ...text() },
      { name: 'rol', ...select(['vendedor', 'admin', 'expedicion']) },
      { name: 'activo', ...bool() },
    ],
  },
  {
    name: 'clientes',
    fields: [
      { name: 'id', ...text() },
      { name: 'numero', ...number() },
      { name: 'razon_social', ...text() },
      { name: 'nombre_fantasia', ...text() },
      { name: 'cuit', ...text() },
      { name: 'direccion', ...text() },
      { name: 'telefono', ...text() },
      { name: 'localidad', ...text() },
      { name: 'provincia', ...text() },
      { name: 'condicion_pago', ...text() },
      { name: 'dias_pago', ...number() },
      { name: 'saldo_cuenta_corriente', ...decimal(2) },
      { name: 'vendedor_id', ...text() },
      { name: 'lista_precio_id', ...text() },
      { name: 'zona', ...text() },
      { name: 'recorrido', ...text() },
      { name: 'estado_cuenta', ...select(['al_dia', 'observado', 'bloqueado']) },
    ],
  },
  {
    name: 'productos',
    fields: [
      { name: 'id', ...text() },
      { name: 'codigo', ...text() },
      { name: 'descripcion', ...text() },
      { name: 'unidad', ...text() },
      { name: 'unidades_por_caja', ...decimal(3) },
      { name: 'peso_promedio_kg', ...decimal(3) }, // NUEVO - para cálculo auto
      { name: 'categoria', ...text() },
      { name: 'marca', ...text() },
      { name: 'nombre_produccion', ...text() },
      { name: 'activo', ...bool() },
    ],
  },
  {
    name: 'listas_precio',
    fields: [
      { name: 'id', ...text() },
      { name: 'nombre', ...text() },
    ],
  },
  {
    name: 'precios',
    fields: [
      { name: 'id', ...text() }, // compuesto: "{lista}_{producto}"
      { name: 'lista_id', ...text() },
      { name: 'producto_id', ...text() },
      { name: 'codigo', ...text() }, // denormalizado para búsqueda
      { name: 'precio', ...decimal(2) },
    ],
  },
  {
    name: 'productos_madre',
    fields: [
      { name: 'madre', ...text() },
      { name: 'hijos_json', ...longText() }, // JSON array string
      { name: 'cantidad_por_tina', ...decimal(2) },
    ],
  },

  // =========== OPERATIVAS ===========
  {
    name: 'pedidos',
    fields: [
      { name: 'id', ...text() },
      { name: 'numero', ...text() },
      { name: 'vendedor_id', ...text() },
      { name: 'vendedor_nombre', ...text() },
      { name: 'cliente_id', ...text() },
      { name: 'cliente_razon_social', ...text() },
      { name: 'cliente_telefono', ...text() },
      { name: 'fecha_pedido', ...date() },
      { name: 'fecha_entrega', ...date() },
      { name: 'condicion_pago', ...text() },
      { name: 'direccion_entrega', ...text() },
      { name: 'transportista', ...text() },
      { name: 'telefono_transporte', ...text() },
      { name: 'direccion_transporte', ...text() },
      { name: 'lineas_json', ...longText() }, // array JSON
      { name: 'total', ...decimal(2) },
      { name: 'estado', ...select(['pendiente', 'aprobado', 'enviado', 'en_produccion', 'entregado', 'finalizado']) },
      { name: 'notas', ...longText() },
      { name: 'alertas_json', ...longText() },
      { name: 'precio_tipo', ...select(['lista', 'especial', 'mixto']) }, // NUEVO
      { name: 'created_at', ...datetime() },
    ],
  },

  // =========== PRODUCCIÓN (4 activas + 4 históricas, schema compartido) ===========
  ...planillasProduccion(),
];

function planillasProduccion() {
  const elaboracion = [
    { name: 'id', ...text() }, { name: 'fecha', ...date() }, { name: 'tina', ...number() },
    { name: 'masa', ...text() }, { name: 'productos_hijos_json', ...longText() },
    { name: 'leche_litros', ...decimal(2) }, { name: 'acidez', ...decimal(2) }, { name: 'grasa', ...decimal(2) },
    { name: 'temp_inicio', ...decimal(1) }, { name: 'hora_inicio', ...text() },
    { name: 'cloruro_calcio', ...decimal(2) }, { name: 'fermento', ...decimal(2) }, { name: 'cuajo', ...decimal(2) },
    { name: 'temp_corte', ...decimal(1) }, { name: 'hora_corte', ...text() },
    { name: 'tiempo_agitacion', ...number() }, { name: 'temp_cocimiento', ...decimal(1) },
    { name: 'hora_desuero', ...text() }, { name: 'suero_litros', ...decimal(2) },
    { name: 'sal_kg', ...decimal(2) }, { name: 'moldes_cantidad', ...number() },
    { name: 'prensado_inicio', ...text() }, { name: 'prensado_fin', ...text() }, { name: 'prensado_peso_kg', ...decimal(2) },
    { name: 'salmuera_inicio', ...text() }, { name: 'salmuera_fin', ...text() },
    { name: 'salmuera_be', ...decimal(2) }, { name: 'salmuera_temp', ...decimal(1) },
    { name: 'maduracion_dias', ...number() }, { name: 'camara', ...text() },
    { name: 'rendimiento_kg', ...decimal(2) }, { name: 'rendimiento_porc', ...decimal(2) },
    { name: 'operario', ...text() }, { name: 'observaciones', ...longText() },
    { name: 'estado', ...select(['en_curso', 'cerrada']) }, { name: 'created_at', ...datetime() },
  ];
  const envasado = [
    { name: 'id', ...text() }, { name: 'fecha', ...date() }, { name: 'producto', ...text() },
    { name: 'lote', ...text() }, { name: 'cantidad_unidades', ...number() }, { name: 'peso_total_kg', ...decimal(2) },
    { name: 'peso_promedio_kg', ...decimal(3) }, { name: 'tipo_envase', ...text() },
    { name: 'operario', ...text() }, { name: 'observaciones', ...longText() },
    { name: 'estado', ...select(['en_curso', 'cerrada']) }, { name: 'created_at', ...datetime() },
  ];
  const expedicion = [
    { name: 'id', ...text() }, { name: 'fecha', ...date() }, { name: 'pedido_id', ...text() },
    { name: 'pedido_numero', ...text() }, { name: 'cliente', ...text() }, { name: 'producto', ...text() },
    { name: 'cantidad_unidades', ...number() }, { name: 'cantidad_cajas', ...number() }, { name: 'peso_kg', ...decimal(2) },
    { name: 'transportista', ...text() }, { name: 'operario', ...text() }, { name: 'observaciones', ...longText() },
    { name: 'estado', ...select(['en_curso', 'cerrada']) }, { name: 'created_at', ...datetime() },
  ];
  const facturacion = [
    { name: 'id', ...text() }, { name: 'fecha', ...date() }, { name: 'pedido_id', ...text() },
    { name: 'cliente', ...text() }, { name: 'tipo_comprobante', ...text() }, { name: 'numero_comprobante', ...text() },
    { name: 'total', ...decimal(2) }, { name: 'observaciones', ...longText() },
    { name: 'estado', ...select(['en_curso', 'cerrada']) }, { name: 'created_at', ...datetime() },
  ];

  return [
    { name: 'elaboracion', fields: elaboracion },
    { name: 'elaboracion_hist', fields: elaboracion },
    { name: 'envasado', fields: envasado },
    { name: 'envasado_hist', fields: envasado },
    { name: 'expedicion', fields: expedicion },
    { name: 'expedicion_hist', fields: expedicion },
    { name: 'facturacion_prod', fields: facturacion },
    { name: 'facturacion_prod_hist', fields: facturacion },
  ];
}
