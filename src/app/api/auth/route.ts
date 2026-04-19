import { NextResponse } from 'next/server';
import { readJsonFile } from '@/lib/data';
import { Vendedor } from '@/types';

// POST /api/auth — Validar credenciales del vendedor
export async function POST(request: Request) {
  try {
    const { usuario, password } = await request.json();
    const vendedores = readJsonFile<Vendedor[]>('vendedores.json');

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
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
