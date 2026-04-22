import { Cliente, EstadoCuenta } from '@/types';

// Criterio automático (si admin no lo seteó a mano):
//   saldo < -50.000  → bloqueado (deuda importante — requiere aprobación)
//   saldo < 0        → observado (deuda menor — deja operar pero avisa)
//   saldo >= 0       → al_dia
// El admin puede sobreescribir desde Cobranzas; el valor manual gana.
export const LIMITE_BLOQUEO = -50000;

export function estadoCuentaDe(c: Pick<Cliente, 'saldo_cuenta_corriente' | 'estado_cuenta'>): EstadoCuenta {
  if (c.estado_cuenta) return c.estado_cuenta;
  if ((c.saldo_cuenta_corriente ?? 0) < LIMITE_BLOQUEO) return 'bloqueado';
  if ((c.saldo_cuenta_corriente ?? 0) < 0) return 'observado';
  return 'al_dia';
}

export const estadoLabel: Record<EstadoCuenta, string> = {
  al_dia: 'Al día',
  observado: 'Observado',
  bloqueado: 'Bloqueado',
};

export const estadoColor: Record<EstadoCuenta, string> = {
  al_dia: 'bg-verde-ok-claro text-verde-ok',
  observado: 'bg-amarillo-claro text-amber-800',
  bloqueado: 'bg-rojo text-white',
};
