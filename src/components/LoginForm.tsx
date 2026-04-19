'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

// Formulario de login para vendedores
export default function LoginForm() {
  const { login } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(usuario, password);
    if (!result.ok) {
      setError(result.error || 'Error al iniciar sesión');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-verde-oscuro to-verde-claro p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-verde-oscuro rounded-full mx-auto flex items-center justify-center mb-4">
            <span className="text-white font-bold text-2xl">EO</span>
          </div>
          <h1 className="text-2xl font-bold text-verde-oscuro">Estancia de Oro</h1>
          <p className="text-gray-500 mt-1">Sistema de Gestión de Pedidos</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="usuario" className="block text-sm font-medium text-gray-700 mb-1">
              Usuario
            </label>
            <input
              id="usuario"
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-verde-oscuro focus:border-transparent outline-none transition-all text-gray-800"
              placeholder="Ingresá tu usuario"
              required
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-verde-oscuro focus:border-transparent outline-none transition-all text-gray-800"
              placeholder="Ingresá tu contraseña"
              required
            />
          </div>

          {/* Mensaje de error */}
          {error && (
            <div className="bg-rojo-claro text-rojo px-4 py-3 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-verde-oscuro hover:bg-verde-claro text-white py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Sistema de uso interno — Estancia de Oro
        </p>
      </div>
    </div>
  );
}
