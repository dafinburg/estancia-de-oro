import { NextResponse } from 'next/server';
import { readProductosMadre } from '@/lib/produccion';

export async function GET() {
  const rows = await readProductosMadre();
  return NextResponse.json(rows);
}
