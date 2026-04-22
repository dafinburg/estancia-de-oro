'use client';

import PlanillaGenerica, { CampoPlanilla } from './PlanillaGenerica';

const PRODUCTOS_ENVASADO = [
  'CREMOSO', 'PORT SALUT', 'TYBO', 'MUZZARELLA', 'PATEGRAS',
  'CRIOLLO', 'FONTINA', 'GOUDA', 'SARDO', 'REGGIANITO',
  'PROVOLETA', 'GRUYERE HORMA', 'GRUYERE CUÑA',
];

export default function TabEnvasado({ hist = false }: { hist?: boolean }) {
  const campos: CampoPlanilla[] = [
    { key: 'fecha', label: 'Fecha', tipo: 'date' },
    { key: 'producto', label: 'Producto', tipo: 'select', opciones: PRODUCTOS_ENVASADO },
    { key: 'lote_elab', label: 'Lote elab.' },
    { key: 'stock_disp', label: 'Stock disp.', tipo: 'number' },
    { key: 'cant_envasada', label: 'Cant. envasada', tipo: 'number' },
    { key: 'kilos_total', label: 'Kilos total', tipo: 'number', paso: 0.01 },
    { key: 'peso_promedio', label: 'Peso promedio', tipo: 'number', paso: 0.01 },
    { key: 'operario', label: 'Operario' },
    { key: 'unidades_turno', label: 'Unid. turno', tipo: 'number' },
    { key: 'observaciones', label: 'Observaciones' },
  ];
  const hoy = new Date().toISOString().split('T')[0];
  return <PlanillaGenerica tipo="envasado" titulo="Envasado" campos={campos} defaultsExtra={{ fecha: hoy, cerrado: false }} hist={hist} />;
}
