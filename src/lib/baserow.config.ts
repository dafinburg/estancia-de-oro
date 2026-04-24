/**
 * Mapeo de tablas Baserow → table_id.
 *
 * Generado por scripts/baserow/setup.mjs (corrida del 2026-04-24).
 * Database ID: 213 en https://baserow.mtrpymes.com.ar
 *
 * Si rehacés el setup (borrás y recreás tablas), actualizá estos IDs con el
 * JSON que imprime el script al final.
 *
 * Nota sobre el campo `ext_id`:
 *   Baserow reserva "id" como nombre de field (es el row_id interno numérico
 *   que genera al crear la fila). Por eso nuestro id textual ("c_001", "v001",
 *   etc.) lo guardamos en el campo `ext_id`. La capa de datos mapea
 *   { ...row, id: row.ext_id } al leer para mantener la API del resto de la app.
 */

export const TABLES = {
  vendedores: 806,
  clientes: 807,
  productos: 808,
  listas_precio: 809,
  precios: 810,
  productos_madre: 811,
  pedidos: 812,
  elaboracion: 813,
  elaboracion_hist: 814,
  envasado: 815,
  envasado_hist: 816,
  expedicion: 817,
  expedicion_hist: 818,
  facturacion_prod: 819,
  facturacion_prod_hist: 820,
} as const;

export type TableName = keyof typeof TABLES;
