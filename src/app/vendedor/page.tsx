'use client';

import VendedorShell from '@/components/VendedorShell';
import ListadoPedidos from '@/components/ListadoPedidos';

// Home del vendedor: listado de sus pedidos + botón nuevo
export default function VendedorHomePage() {
  return (
    <VendedorShell>
      <ListadoPedidos basePath="/vendedor/pedido" />
    </VendedorShell>
  );
}
