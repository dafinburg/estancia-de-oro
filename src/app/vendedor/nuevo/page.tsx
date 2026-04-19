'use client';

import VendedorShell from '@/components/VendedorShell';
import FormularioPedido from '@/components/FormularioPedido';

// Formulario de nuevo pedido para el vendedor
export default function NuevoPedidoPage() {
  return (
    <VendedorShell>
      <FormularioPedido redirectBase="/vendedor/pedido" />
    </VendedorShell>
  );
}
