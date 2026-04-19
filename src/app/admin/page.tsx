'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
export default function Legacy() {
  const r = useRouter();
  useEffect(() => { r.replace('/gestion'); }, [r]);
  return null;
}
