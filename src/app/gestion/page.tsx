'use client';

import GestionShell from '@/components/GestionShell';
import DashboardGestion from '@/components/DashboardGestion';

export default function GestionHome() {
  return (
    <GestionShell>
      <DashboardGestion />
    </GestionShell>
  );
}
