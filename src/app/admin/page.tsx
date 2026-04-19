'use client';

import AppShell from '@/components/AppShell';
import PanelAdmin from '@/components/PanelAdmin';

// Página de administración: solo accesible con usuario admin
export default function AdminPage() {
  return (
    <AppShell requireAdmin>
      <PanelAdmin />
    </AppShell>
  );
}
