'use client';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import LoginForm from '@/components/LoginForm';
import Header from '@/components/Header';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Contenido principal: redirige según el rol del usuario
function HomeContent() {
  const { vendedor, loading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && vendedor) {
      if (isAdmin) {
        router.push('/admin');
      } else {
        router.push('/pedidos/nuevo');
      }
    }
  }, [vendedor, loading, isAdmin, router]);

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

  return (
    <>
      <Header />
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-verde-oscuro border-t-transparent rounded-full" />
      </div>
    </>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <HomeContent />
    </AuthProvider>
  );
}
