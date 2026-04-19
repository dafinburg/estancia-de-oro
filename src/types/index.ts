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
}

export interface Producto {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  unidades_por_caja?: number;
  categoria?: string;
  marca?: string;
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
  subtotal: number;
}

// Estado posible de un pedido
export type EstadoPedido = 'pendiente' | 'aprobado' | 'enviado';

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
