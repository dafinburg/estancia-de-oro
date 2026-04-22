'use client';

import PlanillaGenerica, { CampoPlanilla } from './PlanillaGenerica';

export default function TabFacturacion({ hist = false }: { hist?: boolean }) {
  const campos: CampoPlanilla[] = [
    { key: 'fecha', label: 'Fecha', tipo: 'date' },
    { key: 'cliente', label: 'Cliente' },
    { key: 'cant_total', label: 'Cant. total', tipo: 'number' },
    { key: 'producto', label: 'Producto' },
    { key: 'kilos_total', label: 'Kilos total', tipo: 'number', paso: 0.01 },
    { key: 'peso_promedio', label: 'Peso promedio', tipo: 'number', paso: 0.01 },
    { key: 'facturado', label: 'Facturado', tipo: 'checkbox' },
  ];
  const hoy = new Date().toISOString().split('T')[0];
  return <PlanillaGenerica tipo="facturacion_prod" titulo="Facturación" campos={campos} defaultsExtra={{ fecha: hoy, cerrado: false, facturado: false }} hist={hist} />;
}
