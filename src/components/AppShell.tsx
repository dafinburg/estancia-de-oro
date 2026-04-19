'use client';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import Header from '@/components/Header';
import LoginForm from '@/components/LoginForm';
import { ReactNode } from 'react';

// Shell de la aplicación: maneja autenticación y layout principal
function AppShellInner({ children, requireAdmin }: { children: ReactNode; requireAdmin?: boolean }) {
  const { vendedor, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-verde-oscuro border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!vendedor) {
    return <LoginForm />;
  }

  // Si requiere admin y no lo es, mostrar error
  if (requireAdmin && !isAdmin) {
    return (
      <>
        <Header />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-rojo mb-2">Acceso denegado</h2>
            <p className="text-gray-600">No tenés permisos para acceder a esta sección.</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="flex-1 bg-[var(--gris-fondo)]">
        {children}
      </main>
    </>
  );
}

export default function AppShell({ children, requireAdmin }: { children: ReactNode; requireAdmin?: boolean }) {
  return (
    <AuthProvider>
      <AppShellInner requireAdmin={requireAdmin}>
        {children}
      </AppShellInner>
    </AuthProvider>
  );
}
