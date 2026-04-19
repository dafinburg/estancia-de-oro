'use client';

import AppShell from '@/components/AppShell';
import FormularioPedido from '@/components/FormularioPedido';

// Página para crear un nuevo pedido
export default function NuevoPedidoPage() {
  return (
    <AppShell>
      <FormularioPedido />
    </AppShell>
  );
}
