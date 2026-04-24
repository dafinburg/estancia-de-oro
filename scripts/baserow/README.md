# Setup de Baserow

Scripts para migrar Estancia de Oro de Google Sheets a Baserow.

## 1. Preparar credenciales

```bash
cp .env.local.baserow.example .env.local.baserow
```

Editá `.env.local.baserow` y completá `BASEROW_PASSWORD` con la contraseña de
tu usuario de Baserow (no se sube a git, está en `.gitignore`).

## 2. Correr el setup

```bash
npm run baserow:setup
```

El script:
1. Hace login contra `baserow.mtrpymes.com.ar` con user/password.
2. Crea 16 tablas en la database 213 (si ya existen, las saltea).
3. Por cada tabla nueva, configura los campos con el tipo correcto
   (text, number, date, boolean, single_select, etc.).
4. Importa los maestros desde `data/*.json`:
   - `clientes` (~2500 filas)
   - `vendedores` (6 filas)
   - `productos` (25 filas)
   - `listas_precio` (1 fila)
   - `precios` (precios aplanados)
   - `productos_madre` (7 filas)
5. Las tablas operativas (`pedidos`, planillas de producción) quedan vacías.
6. Al final imprime un JSON con `{ nombre_tabla: id_tabla }` — hay que pegarlo
   en `src/lib/baserow.config.ts` para que la app lo use.

## 3. Verificar en la UI

Abrí `https://baserow.mtrpymes.com.ar/database/213/` y deberías ver las 16
tablas con los datos de maestros cargados.

## Idempotencia

Si el script ya corrió y una tabla existe, **no** reimporta sus datos. Si querés
rearmar de cero, borrá las tablas manualmente desde la UI y volvé a correr.

## Tipos de campos

Baserow no permite modificar el "primary field" una vez configurado a ciertos
tipos — por eso el script lo renombra in-place antes de crear los demás.

## Troubleshooting

- **HTTP 401 en login**: revisá `BASEROW_USER` / `BASEROW_PASSWORD`.
- **HTTP 403 creando tabla**: tu usuario no tiene permisos admin sobre la
  database 213. Revisalo en Baserow → Workspace settings.
- **Tablas con campos raros después de una corrida fallida**: borralas en la UI
  y corré el script otra vez.
