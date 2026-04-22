/**
 * Cache en memoria con TTL para reducir fetches repetidos al Google Sheet.
 *
 * Escenario: lecturas como clientes/vendedores/listas se piden en casi cada
 * request de la UI. Cada fetch al Apps Script tarda 2–5s. Con TTL corto
 * amortizamos ese costo sin quedar desincronizados más de unos segundos.
 *
 * Se expone invalidate() para cuando hacemos una escritura y queremos forzar
 * la próxima lectura a ir al Sheet.
 */

type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();

export async function cached<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > now) {
    return hit.value;
  }
  const value = await loader();
  store.set(key, { value, expiresAt: now + ttlSeconds * 1000 });
  return value;
}

export function invalidate(key: string): void {
  store.delete(key);
}

export function invalidateAll(): void {
  store.clear();
}
