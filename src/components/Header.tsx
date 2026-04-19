'use client';

import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useState } from 'react';

// Header principal: muestra logo, datos del vendedor y navegación
export default function Header() {
  const { vendedor, logout, isAdmin } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!vendedor) return null;

  return (
    <header className="bg-verde-oscuro text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo y nombre */}
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <span className="text-verde-oscuro font-bold text-lg">EO</span>
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Estancia de Oro</h1>
            <p className="text-xs text-green-300">Sistema de Pedidos</p>
          </div>
        </Link>

        {/* Navegación desktop */}
        <nav className="hidden md:flex items-center gap-6">
          {isAdmin ? (
            <>
              <Link href="/admin" className="hover:text-green-300 transition-colors text-sm font-medium">
                Panel Admin
              </Link>
            </>
          ) : (
            <>
              <Link href="/pedidos/nuevo" className="hover:text-green-300 transition-colors text-sm font-medium">
                Nuevo Pedido
              </Link>
              <Link href="/pedidos" className="hover:text-green-300 transition-colors text-sm font-medium">
                Mis Pedidos
              </Link>
            </>
          )}
        </nav>

        {/* Datos del vendedor y logout */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium">{vendedor.nombre}</p>
            <p className="text-xs text-green-300">{isAdmin ? 'Administrador' : vendedor.region}</p>
          </div>
          <button
            onClick={logout}
            className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded text-sm transition-colors"
          >
            Salir
          </button>
          {/* Menú hamburguesa mobile */}
          <button
            className="md:hidden p-1"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        </div>
      </div>

      {/* Menú mobile desplegable */}
      {menuOpen && (
        <nav className="md:hidden border-t border-white/20 px-4 py-3 flex flex-col gap-2">
          <p className="text-sm text-green-300 sm:hidden">{vendedor.nombre} — {vendedor.region}</p>
          {isAdmin ? (
            <Link href="/admin" onClick={() => setMenuOpen(false)} className="py-2 hover:text-green-300 text-sm">
              Panel Admin
            </Link>
          ) : (
            <>
              <Link href="/pedidos/nuevo" onClick={() => setMenuOpen(false)} className="py-2 hover:text-green-300 text-sm">
                Nuevo Pedido
              </Link>
              <Link href="/pedidos" onClick={() => setMenuOpen(false)} className="py-2 hover:text-green-300 text-sm">
                Mis Pedidos
              </Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
