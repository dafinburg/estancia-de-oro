'use client';
import { useRouter, useParams } from 'next/navigation';
import { useEffect } from 'react';
export default function Legacy() {
  const r = useRouter();
  const p = useParams();
  useEffect(() => { r.replace(`/vendedor/pedido/${p.id}`); }, [r, p.id]);
  return null;
}
