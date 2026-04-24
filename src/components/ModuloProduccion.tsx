'use client';

import { useState } from 'react';
import TabElaboracion from '@/components/produccion/TabElaboracion';
import TabEnvasado from '@/components/produccion/TabEnvasado';
import TabExpedicion from '@/components/produccion/TabExpedicion';
import TabFacturacion from '@/components/produccion/TabFacturacion';
import PlanificacionProduccion from '@/components/produccion/PlanificacionProduccion';
import ExpedicionPorCliente from '@/components/produccion/ExpedicionPorCliente';

type Tab =
  | 'por_cliente'
  | 'planificacion'
  | 'elaboracion'
  | 'envasado'
  | 'expedicion'
  | 'facturacion'
  | 'elaboracion_hist'
  | 'envasado_hist'
  | 'expedicion_hist'
  | 'facturacion_hist';

const TABS: { key: Tab; label: string; grupo: 'op' | 'hist' }[] = [
  { key: 'por_cliente', label: 'Pedidos por cliente', grupo: 'op' },
  { key: 'planificacion', label: 'Planificación', grupo: 'op' },
  { key: 'elaboracion', label: 'Elaboración', grupo: 'op' },
  { key: 'envasado', label: 'Envasado', grupo: 'op' },
  { key: 'expedicion', label: 'Planilla exped.', grupo: 'op' },
  { key: 'facturacion', label: 'Facturación', grupo: 'op' },
  { key: 'elaboracion_hist', label: 'Hist. Elab.', grupo: 'hist' },
  { key: 'envasado_hist', label: 'Hist. Envasado', grupo: 'hist' },
  { key: 'expedicion_hist', label: 'Hist. Exped.', grupo: 'hist' },
  { key: 'facturacion_hist', label: 'Hist. Fact.', grupo: 'hist' },
];

export default function ModuloProduccion() {
  const [tab, setTab] = useState<Tab>('por_cliente');

  return (
    <div className="max-w-full mx-auto p-4 md:p-6 space-y-4">
      <div className="no-print">
        <h1 className="text-2xl font-bold text-verde-oscuro">Expedición</h1>
        <p className="text-gray-500 text-sm">Pedidos agrupados por cliente y planillas oficiales de producción</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b no-print">
        {TABS.filter(t => t.grupo === 'op').map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm rounded-t-lg ${tab === t.key ? 'bg-verde-oscuro text-white font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            {t.label}
          </button>
        ))}
        <span className="mx-2 w-px bg-gray-200" />
        {TABS.filter(t => t.grupo === 'hist').map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs rounded-t-lg ${tab === t.key ? 'bg-gray-700 text-white font-medium' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-2">
        {tab === 'por_cliente' && <ExpedicionPorCliente />}
        {tab === 'planificacion' && <PlanificacionProduccion />}
        {tab === 'elaboracion' && <TabElaboracion />}
        {tab === 'envasado' && <TabEnvasado />}
        {tab === 'expedicion' && <TabExpedicion />}
        {tab === 'facturacion' && <TabFacturacion />}
        {tab === 'elaboracion_hist' && <TabElaboracion hist />}
        {tab === 'envasado_hist' && <TabEnvasado hist />}
        {tab === 'expedicion_hist' && <TabExpedicion hist />}
        {tab === 'facturacion_hist' && <TabFacturacion hist />}
      </div>
    </div>
  );
}
