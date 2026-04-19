'use client';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import LoginForm from '@/components/LoginForm';
import Link from 'next/link';
import { ReactNode, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Shell del back-office (sistema de gestión interno)
// Sidebar con módulos: Pedidos, Cobranzas, Producción, Clientes, Productos
const MENU = [
  { href: '/gestion', label: 'Dashboard', icon: '📊' },
  { href: '/gestion/pedidos', label: 'Pedidos', icon: '📋' },
  { href: '/gestion/cobranzas', label: 'Cobranzas', icon: '💰' },
  { href: '/gestion/produccion', label: 'Producción', icon: '🏭' },
  { href: '/gestion/clientes', label: 'Clientes', icon: '👥' },
  { href: '/gestion/productos', label: 'Productos', icon: '📦' },
];

function Inner({ children }: { children: ReactNode }) {
  const { vendedor, loading, isAdmin, logout } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-verde-oscuro border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!vendedor) return <LoginForm />;
  if (!isAdmin) {
    // Un vendedor por error cayó en /gestion → mandarlo al app vendedor
    if (typeof window !== 'undefined') router.replace('/vendedor');
    return null;
  }

  return (
    <div className="flex min-h-screen bg-[var(--gris-fondo)]">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-60 bg-verde-oscuro text-white flex-col fixed inset-y-0 left-0 z-30">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center">
              <span className="text-verde-oscuro font-bold text-sm">EO</span>
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">Estancia de Oro</h1>
              <p className="text-[10px] text-green-300 uppercase tracking-wide">Gestión Interna</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {MENU.map((item) => {
            const active = pathname === item.href || (item.href !== '/gestion' && pathname?.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active ? 'bg-white/15 text-white font-medium' : 'text-green-100 hover:bg-white/10'
                }`}>
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-white/10">
          <p className="text-xs text-green-300">{vendedor.nombre}</p>
          <button onClick={logout} className="mt-2 text-xs bg-white/10 hover:bg-white/20 w-full py-1.5 rounded transition-colors">
            Salir
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 bg-verde-oscuro text-white flex items-center justify-between px-4 py-3 shadow">
        <button onClick={() => setSidebarOpen(true)} className="p-1">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="font-bold">Estancia de Oro</span>
        <button onClick={logout} className="text-xs bg-white/10 px-2 py-1 rounded">Salir</button>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
          <aside className="md:hidden fixed inset-y-0 left-0 w-60 bg-verde-oscuro text-white z-50 flex flex-col">
            <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
              <h1 className="text-base font-bold">Estancia de Oro</h1>
              <button onClick={() => setSidebarOpen(false)}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {MENU.map((item) => {
                const active = pathname === item.href || (item.href !== '/gestion' && pathname?.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                      active ? 'bg-white/15 text-white font-medium' : 'text-green-100 hover:bg-white/10'
                    }`}>
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </>
      )}

      <main className="flex-1 md:ml-60 pt-14 md:pt-0">{children}</main>
    </div>
  );
}

export default function GestionShell({ children }: { children: ReactNode }) {
  return <AuthProvider><Inner>{children}</Inner></AuthProvider>;
}
