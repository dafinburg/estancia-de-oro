'use client';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import LoginForm from '@/components/LoginForm';
import Link from 'next/link';
import { ReactNode, useState } from 'react';
import { useRouter } from 'next/navigation';

// Shell simple para la app de vendedores (toma de pedidos)
// Header minimal + navegación rápida a "Nuevo pedido" y "Mis pedidos"
function Inner({ children }: { children: ReactNode }) {
  const { vendedor, loading, isAdmin, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-verde-oscuro border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!vendedor) return <LoginForm />;
  if (isAdmin) {
    // Un admin por error cayó acá → mandarlo al back-office
    if (typeof window !== 'undefined') router.replace('/gestion');
    return null;
  }

  return (
    <>
      <header className="bg-verde-oscuro text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/vendedor" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center">
              <span className="text-verde-oscuro font-bold text-sm">EO</span>
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">Estancia de Oro</h1>
              <p className="text-[10px] text-green-300 uppercase tracking-wide">Toma de pedidos</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-5 text-sm font-medium">
            <Link href="/vendedor" className="hover:text-green-300">Mis pedidos</Link>
            <Link href="/vendedor/nuevo" className="bg-amarillo text-amber-900 px-3 py-1.5 rounded-full hover:bg-amber-400">
              + Nuevo pedido
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium">{vendedor.nombre}</p>
              <p className="text-[10px] text-green-300">{vendedor.region}</p>
            </div>
            <button onClick={logout} className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded text-xs">Salir</button>
            <button className="md:hidden p-1" onClick={() => setMenuOpen(!menuOpen)}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="md:hidden border-t border-white/20 px-4 py-3 flex flex-col gap-2 text-sm">
            <Link href="/vendedor" onClick={() => setMenuOpen(false)} className="py-2">Mis pedidos</Link>
            <Link href="/vendedor/nuevo" onClick={() => setMenuOpen(false)} className="py-2 text-amarillo font-medium">+ Nuevo pedido</Link>
          </nav>
        )}
      </header>
      <main className="flex-1 bg-[var(--gris-fondo)]">{children}</main>
    </>
  );
}

export default function VendedorShell({ children }: { children: ReactNode }) {
  return <AuthProvider><Inner>{children}</Inner></AuthProvider>;
}
