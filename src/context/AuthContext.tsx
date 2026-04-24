'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Vendedor } from '@/types';

// Contexto de autenticación: maneja login, logout y sesión del vendedor
interface AuthContextType {
  vendedor: Vendedor | null;
  loading: boolean;
  login: (usuario: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  isAdmin: boolean;
  isExpedicion: boolean;
  /** Tiene acceso al back-office (admin o expedicion) */
  canAccessGestion: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [vendedor, setVendedor] = useState<Vendedor | null>(null);
  const [loading, setLoading] = useState(true);

  // Al montar, verificar si hay sesión guardada en localStorage
  useEffect(() => {
    const stored = localStorage.getItem('vendedor_session');
    if (stored) {
      try {
        setVendedor(JSON.parse(stored));
      } catch {
        localStorage.removeItem('vendedor_session');
      }
    }
    setLoading(false);
  }, []);

  // Función de login: consulta la API para validar credenciales
  const login = async (usuario: string, password: string) => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, password }),
      });
      const data = await res.json();
      if (data.ok) {
        // Guardar sesión sin la contraseña
        const { password: _, ...vendedorSinPass } = data.vendedor;
        setVendedor(vendedorSinPass);
        localStorage.setItem('vendedor_session', JSON.stringify(vendedorSinPass));
        return { ok: true };
      }
      return { ok: false, error: data.error || 'Credenciales inválidas' };
    } catch {
      return { ok: false, error: 'Error de conexión' };
    }
  };

  const logout = () => {
    setVendedor(null);
    localStorage.removeItem('vendedor_session');
  };

  const isAdmin = vendedor?.rol === 'admin';
  const isExpedicion = vendedor?.rol === 'expedicion';
  const canAccessGestion = isAdmin || isExpedicion;

  return (
    <AuthContext.Provider value={{ vendedor, loading, login, logout, isAdmin, isExpedicion, canAccessGestion }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
