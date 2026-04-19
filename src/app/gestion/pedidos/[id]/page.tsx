'use client';

import GestionShell from '@/components/GestionShell';
import DetallePedido from '@/components/DetallePedido';

export default function GestionPedidoDetallePage() {
  return (
    <GestionShell>
      <DetallePedido backHref="/gestion/pedidos" newHref="/gestion/pedidos" />
    </GestionShell>
  );
}
