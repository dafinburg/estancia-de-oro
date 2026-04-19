import { NextResponse } from 'next/server';
import { readJsonFile } from '@/lib/data';
import { Producto } from '@/types';

// GET /api/productos — Obtener todos los productos activos
export async function GET() {
  try {
    const productos = readJsonFile<Producto[]>('productos.json');
    const activos = productos.filter((p) => p.activo);
    return NextResponse.json(activos);
  } catch {
    return NextResponse.json({ error: 'Error al leer productos' }, { status: 500 });
  }
}
