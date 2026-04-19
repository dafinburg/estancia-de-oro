'use client';

import AppShell from '@/components/AppShell';
import ListadoPedidos from '@/components/ListadoPedidos';

// Página de listado de pedidos del vendedor
export default function PedidosPage() {
  return (
    <AppShell>
      <ListadoPedidos />
    </AppShell>
  );
}
