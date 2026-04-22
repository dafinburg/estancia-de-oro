import { NextResponse } from 'next/server';
import { readVendedores } from '@/lib/data';

// POST /api/auth — Validar credenciales
// Lee vendedores desde el Sheet en producción, JSON en dev.
export async function POST(request: Request) {
  try {
    const { usuario, password } = await request.json();
    const vendedores = await readVendedores();

    const vendedor = vendedores.find(
      (v) => v.usuario === usuario && v.password === password
    );

    if (!vendedor) {
      return NextResponse.json(
        { ok: false, error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      );
    }

    return NextResponse.json({ ok: true, vendedor });
  } catch (err) {
    console.error('Error en /api/auth:', err);
    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
