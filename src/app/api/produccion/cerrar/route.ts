import { NextResponse } from 'next/server';
import { cerrarPlanilla } from '@/lib/produccion';
import { TipoPlanilla } from '@/types';

const VALIDOS: TipoPlanilla[] = ['elaboracion', 'envasado', 'expedicion', 'facturacion_prod'];

export async function POST(req: Request) {
  const { tipo } = await req.json();
  if (!VALIDOS.includes(tipo)) return NextResponse.json({ error: 'tipo inválido' }, { status: 400 });
  const movidas = await cerrarPlanilla(tipo as TipoPlanilla);
  return NextResponse.json({ ok: true, movidas });
}
