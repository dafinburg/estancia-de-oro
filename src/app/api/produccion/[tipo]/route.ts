import { NextResponse } from 'next/server';
import {
  readPlanilla,
  createPlanillaRow,
  updatePlanillaRow,
  deletePlanillaRow,
} from '@/lib/produccion';
import { TipoPlanilla } from '@/types';

const VALIDOS: TipoPlanilla[] = ['elaboracion', 'envasado', 'expedicion', 'facturacion_prod'];

function validar(tipo: string): tipo is TipoPlanilla {
  return (VALIDOS as string[]).includes(tipo);
}

export async function GET(req: Request, ctx: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await ctx.params;
  if (!validar(tipo)) return NextResponse.json({ error: 'tipo inválido' }, { status: 400 });
  const { searchParams } = new URL(req.url);
  const hist = searchParams.get('hist') === '1';
  const rows = await readPlanilla(tipo, hist);
  return NextResponse.json(rows);
}

export async function POST(req: Request, ctx: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await ctx.params;
  if (!validar(tipo)) return NextResponse.json({ error: 'tipo inválido' }, { status: 400 });
  const body = await req.json();
  const row = await createPlanillaRow(tipo, body);
  return NextResponse.json({ ok: true, registro: row });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await ctx.params;
  if (!validar(tipo)) return NextResponse.json({ error: 'tipo inválido' }, { status: 400 });
  const { id, cambios } = await req.json();
  if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
  const ok = await updatePlanillaRow(tipo, id, cambios || {});
  return NextResponse.json({ ok });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await ctx.params;
  if (!validar(tipo)) return NextResponse.json({ error: 'tipo inválido' }, { status: 400 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
  const ok = await deletePlanillaRow(tipo, id);
  return NextResponse.json({ ok });
}
