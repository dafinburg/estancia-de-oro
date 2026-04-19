import { NextResponse } from 'next/server';
import { readJsonFile } from '@/lib/data';
import { Vendedor } from '@/types';

// GET /api/vendedores — listar vendedores (sin contraseñas)
export async function GET() {
  try {
    const vs = readJsonFile<Vendedor[]>('vendedores.json');
    const publicList = vs.map((v) => {
      const { password: _p, ...rest } = v;
      return rest;
    });
    return NextResponse.json(publicList);
  } catch {
    return NextResponse.json({ error: 'Error al leer vendedores' }, { status: 500 });
  }
}
