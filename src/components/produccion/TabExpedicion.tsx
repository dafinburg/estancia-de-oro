'use client';

import PlanillaGenerica, { CampoPlanilla } from './PlanillaGenerica';

const PRODUCTOS_EXPEDICION = [
  'CREMOSO', 'PORT SALUT', 'TYBO', 'MUZZARELLA', 'PATEGRAS',
  'CRIOLLO', 'FONTINA', 'GOUDA', 'SARDO', 'REGGIANITO',
  'PROVOLETA', 'GRUYERE HORMA', 'GRUYERE CUÑA',
  'CREMA DE SUERO x KG', 'CREMA DE LECHE x KG', 'RECORTES x KG', 'DEVOLUCIONES x KG',
  'Roquefort',
  'Manteca x 100 GR (CAJA x 20)', 'Manteca x 100 GR x Unidad',
  'Manteca x 200 GR (CAJA x 30)', 'Manteca x 200 GR x Unidad',
  'Aderezo Rallado x 40 Gr', 'Aderezo Rallado x 120 Gr',
  'Dulce de Leche x 400 GR  (CAJA X 12)', 'Dulce de Leche X 400 GR X U',
];

export default function TabExpedicion({ hist = false }: { hist?: boolean }) {
  const campos: CampoPlanilla[] = [
    { key: 'fecha', label: 'Fecha', tipo: 'date' },
    { key: 'cliente', label: 'Cliente' },
    { key: 'producto', label: 'Producto', tipo: 'select', opciones: PRODUCTOS_EXPEDICION },
    { key: 'lote', label: 'Lote' },
    { key: 'stock_disp', label: 'Stock disp.', tipo: 'number' },
    { key: 'unid_preparadas', label: 'Unid. preparadas', tipo: 'number' },
    { key: 'kilos_preparados', label: 'Kilos preparados', tipo: 'number', paso: 0.01 },
    { key: 'peso_promedio', label: 'Peso promedio', tipo: 'number', paso: 0.01 },
    { key: 'operario', label: 'Operario' },
  ];
  const hoy = new Date().toISOString().split('T')[0];
  return <PlanillaGenerica tipo="expedicion" titulo="Expedición" campos={campos} defaultsExtra={{ fecha: hoy, cerrado: false }} hist={hist} />;
}
