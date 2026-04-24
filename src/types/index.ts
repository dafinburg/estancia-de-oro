// Tipos principales de la aplicación Estancia de Oro

export interface Vendedor {
  id: string;
  nombre: string;
  usuario: string;
  password: string;
  region: string;
  clientes: string[];
  lista_precio_id: string;
  rol?: 'admin';
}

export interface Cliente {
  id: string;
  numero?: number;
  razon_social: string;
  nombre_fantasia?: string;
  cuit: string;
  direccion: string;
  telefono?: string;
  localidad?: string;
  provincia?: string;
  condicion_pago: string;
  dias_pago?: number;
  saldo_cuenta_corriente: number;
  lista_precio_id: string;
  vendedor_id?: string;
  zona?: string;
  recorrido?: string;
  // Estado de la cuenta corriente — set manualmente desde Cobranzas, o derivado del saldo si no está.
  // al_dia    → operativo normal
  // observado → puede pedir pero el formulario avisa
  // bloqueado → no puede generar pedidos (requiere autorización de admin)
  estado_cuenta?: EstadoCuenta;
}

export type EstadoCuenta = 'al_dia' | 'observado' | 'bloqueado';

export interface Producto {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  unidades_por_caja?: number;
  /** Peso promedio por unidad en kg — se usa para el cálculo auto de kg totales
   *  en el formulario de pedido (unidades × peso_promedio_kg). */
  peso_promedio_kg?: number;
  categoria?: string;
  marca?: string;
  /** Nombre para planillas de producción (puede diferir del descripcion comercial). */
  nombre_produccion?: string;
  activo: boolean;
}

export interface PrecioProducto {
  producto_id: string;
  precio: number;
}

export interface ListaPrecio {
  id: string;
  nombre: string;
  precios: PrecioProducto[];
}

// Línea de detalle dentro de un pedido
// Siguiendo el template: cajas × unidades_por_caja = unidades_totales, precio por kg
export interface LineaPedido {
  producto_id: string;
  codigo: string;
  descripcion: string;
  unidades_por_caja: number;
  cajas: number; // cantidad de cajas pedidas
  cantidad: number; // unidades totales (cajas × unidades_por_caja)
  kg_aprox: number; // kg aproximados
  precio_unitario: number; // precio $ por kg (o por unidad si no aplica kg)
  precio_lista: number; // precio de referencia de la lista
  precio_bonificado: number; // precio luego de bonificación
  descuento_porcentaje: number; // % de descuento autorizado aplicado sobre precio_unitario (0–100)
  subtotal: number;
}

// Estado posible de un pedido
export type EstadoPedido = 'pendiente' | 'aprobado' | 'enviado' | 'en_produccion' | 'entregado' | 'finalizado';

export interface Pedido {
  id: string;
  numero: string; // formato EDO-YYYYMMDD-XXX
  vendedor_id: string;
  vendedor_nombre: string;
  cliente_id: string;
  cliente_razon_social: string;
  cliente_telefono?: string;
  fecha_pedido: string;
  fecha_entrega: string;
  condicion_pago: string;
  transportista: string;
  direccion_transporte?: string;
  telefono_transporte?: string;
  direccion_entrega: string;
  lineas: LineaPedido[];
  total: number;
  estado: EstadoPedido;
  notas: string;
  alertas: AlertaPedido[];
  created_at: string;
}

// Alertas generadas por las validaciones
export interface AlertaPedido {
  tipo: 'precio_bajo' | 'saldo_vencido' | 'saldo_bloqueado';
  mensaje: string;
  nivel: 'warning' | 'error';
}

// Resultado de validación para mostrar en el panel
export interface ResultadoValidacion {
  campo: string;
  estado: 'ok' | 'warning' | 'error';
  mensaje: string;
}

// ============================================================
// PRODUCCIÓN — modelos que replican la "PLANILLA ELABORACION OFICIAL"
// ============================================================

// Catálogo madre → hijos (de una tina de masa madre salen N variantes hijas)
// Ej: PATEGRAS → [PATEGRAS, CRIOLLO, FONTINA] (3 hijos)
export interface ProductoMadre {
  madre: string;
  hijos: string[];
  cantidad_por_tina: number;
}

// Elaboración: 1 fila = 1 tina de quesería con todos los parámetros de proceso
export interface ElaboracionRow {
  id: string;
  fecha: string;       // ISO yyyy-mm-dd
  tina: number | '';
  masa: string;        // producto madre (CREMOSO, TYBO, PATEGRAS, ...)
  litros: number | '';
  lote: string;
  cant_1: number | '';
  queso_1: string;
  cant_2: number | '';
  queso_2: string;
  cant_3: number | '';
  queso_3: string;
  tina_fisica: number | string | '';
  desinf_inicial: string;
  crema_kg: number | '';
  grasa_pct: number | string | '';
  proteina_pct: number | string | '';
  silo_fecha_almacenamiento: string;
  hora_fermento: string;
  hora_coag: string;
  t_coagulacion: number | '';
  t_corte: string;
  t_coccion: number | '';
  ph_tina: number | string | '';
  cant_calcio: number | '';
  lote_calcio: string;
  cant_fermento: string;
  lote_fermento: string;
  cant_colorante: string;
  lote_colorante: string;
  cant_coagulante: string;
  lote_coagulante: string;
  resp_quesero: string;
  hora_moldeo: string;
  ph_moldeo: string;
  resp_moldeo: string;
  salmuera_n: number | string | '';
  densidad_salmuera: number | string | '';
  temp_ingreso_salmuera: string;
  hora_ingreso_salmuera: string;
  hora_salida_salmuera: string;
  resp_salmuera: string;
  observaciones: string;
  subproductos: string;
  kg_subproductos: number | '';
  cerrado?: boolean;
}

export interface EnvasadoRow {
  id: string;
  fecha: string;
  producto: string;
  lote_elab: string;
  stock_disp: number | '';
  cant_envasada: number | '';
  kilos_total: number | '';
  peso_promedio: number | '';
  operario: string;
  unidades_turno: number | '';
  observaciones: string;
  cerrado?: boolean;
}

export interface ExpedicionRow {
  id: string;
  fecha: string;
  cliente: string;
  producto: string;
  lote: string;
  stock_disp: number | '';
  unid_preparadas: number | '';
  kilos_preparados: number | '';
  peso_promedio: number | '';
  operario: string;
  cerrado?: boolean;
}

export interface FacturacionProdRow {
  id: string;
  fecha: string;
  cliente: string;
  cant_total: number | '';
  producto: string;
  kilos_total: number | '';
  peso_promedio: number | '';
  facturado: boolean | string;
  cerrado?: boolean;
}

export type TipoPlanilla = 'elaboracion' | 'envasado' | 'expedicion' | 'facturacion_prod';
