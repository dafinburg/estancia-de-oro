// Utilidades de formateo para la aplicación

// Formatear número como moneda argentina (pesos)
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(amount);
}

// Formatear fecha ISO a formato legible dd/mm/yyyy
export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

// Generar número de pedido con formato EDO-YYYYMMDD-XXX
export function generarNumeroPedido(fecha: string, secuencia: number): string {
  const fechaLimpia = fecha.replace(/-/g, '');
  const sec = String(secuencia).padStart(3, '0');
  return `EDO-${fechaLimpia}-${sec}`;
}
