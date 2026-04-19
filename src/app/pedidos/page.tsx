'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
// Ruta legacy → redirige a /vendedor
export default function Legacy() {
  const r = useRouter();
  useEffect(() => { r.replace('/vendedor'); }, [r]);
  return null;
}
