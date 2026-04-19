'use client';

import { ResultadoValidacion } from '@/types';

// Panel que muestra el resumen de validaciones antes de confirmar el pedido
// Usa iconos y colores para indicar el estado de cada validación
interface Props {
  validaciones: ResultadoValidacion[];
}

export default function PanelValidaciones({ validaciones }: Props) {
  if (validaciones.length === 0) return null;

  const iconos = {
    ok: '✓',
    warning: '⚠',
    error: '✗',
  };

  const colores = {
    ok: 'bg-verde-ok-claro text-verde-ok border-verde-ok/30',
    warning: 'bg-amarillo-claro text-amber-800 border-amarillo/30',
    error: 'bg-rojo-claro text-rojo border-rojo/30',
  };

  const tieneErrores = validaciones.some((v) => v.estado === 'error');
  const tieneWarnings = validaciones.some((v) => v.estado === 'warning');

  return (
    <div className="border rounded-xl overflow-hidden">
      {/* Título del panel */}
      <div className={`px-4 py-3 font-medium text-sm ${
        tieneErrores
          ? 'bg-rojo-claro text-rojo'
          : tieneWarnings
          ? 'bg-amarillo-claro text-amber-800'
          : 'bg-verde-ok-claro text-verde-ok'
      }`}>
        {tieneErrores
          ? '✗ Hay errores que deben corregirse'
          : tieneWarnings
          ? '⚠ Hay advertencias — podés continuar'
          : '✓ Todas las validaciones pasaron correctamente'}
      </div>

      {/* Lista de validaciones */}
      <div className="divide-y">
        {validaciones.map((v, i) => (
          <div key={i} className={`flex items-start gap-3 px-4 py-3 ${colores[v.estado]} border-l-4`}>
            <span className="text-lg font-bold mt-0.5">{iconos[v.estado]}</span>
            <div>
              <p className="font-medium text-sm">{v.campo}</p>
              <p className="text-xs mt-0.5 opacity-80">{v.mensaje}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
