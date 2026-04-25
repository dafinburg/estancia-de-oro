import { NextResponse } from 'next/server';
import { readVendedores } from '@/lib/data';

// GET /api/vendedores — listar vendedores (sin contraseñas)
// En producción lee del Sheet (hoja Vendedores + reconstruye clientes desde Clientes).
export async function GET() {
  try {
    const vs = await readVendedores();
    const publicList = vs.map((v) => {
      const { password: _p, ...rest } = v;
      return rest;
    });
    return NextResponse.json(publicList, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
    });
  } catch (err) {
    console.error('Error en /api/vendedores:', err);
    return NextResponse.json({ error: 'Error al leer vendedores' }, { status: 500 });
  }
}
