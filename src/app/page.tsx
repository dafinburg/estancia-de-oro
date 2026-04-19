'use client';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import LoginForm from '@/components/LoginForm';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Página raíz: login → redirige según rol
// - Vendedor → /vendedor (app simple de toma de pedidos)
// - Admin → /gestion (back-office: pedidos, cobranzas, producción, etc.)
function HomeContent() {
  const { vendedor, loading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && vendedor) {
      router.replace(isAdmin ? '/gestion' : '/vendedor');
    }
  }, [vendedor, loading, isAdmin, router]);

  if (loading || vendedor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-verde-oscuro to-verde-claro">
        <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
      </div>
    );
  }
  return <LoginForm />;
}

export default function Home() {
  return (
    <AuthProvider>
      <HomeContent />
    </AuthProvider>
  );
}
