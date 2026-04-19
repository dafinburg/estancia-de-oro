'use client';

import VendedorShell from '@/components/VendedorShell';
import DetallePedido from '@/components/DetallePedido';

// Detalle de un pedido del vendedor
export default function PedidoVendedorPage() {
  return (
    <VendedorShell>
      <DetallePedido backHref="/vendedor" />
    </VendedorShell>
  );
}
