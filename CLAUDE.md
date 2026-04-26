# CLAUDE.md

Contexto para Claude Code cuando trabaje en este proyecto. Actualizar cuando la arquitectura cambie.

## Estado actual (abril 2026) — RESUMEN VIGENTE

**Producción**: https://estancia-de-oro.vercel.app · branch `master` · deploy automático en Vercel.

**Fuente de datos**: **Baserow self-hosted** (workspace 140, database 213). Token: ver global CLAUDE.md (`dVqMuLbdvmWQ1T9ligh367xlY4DBArLd`). Tablas: 806–820 mapeadas en `src/lib/baserow.config.ts`.

Env vars en Vercel production:
- `DATA_SOURCE=baserow` (activa el modo Baserow en `src/lib/data.ts`)
- `BASEROW_URL=https://baserow.mtrpymes.com.ar`
- `BASEROW_TOKEN=...`
- `GOOGLE_SHEETS_WEBHOOK_URL` (queda como fallback histórico, ya no se usa)

**Roles de usuario** (`Vendedor.rol`):
- `undefined` → vendedor común (ve `/vendedor/*`, sólo sus clientes)
- `'admin'` → back-office completo en `/gestion/*`
- `'expedicion'` → sólo `/gestion/produccion` (renombrado a "Expedición" 🚚 en UI)
- Login admin: `admin` / `admin2024`

**Lo que se hizo en esta tanda de cambios**:
1. **Migración a Baserow** — `data.ts` y `produccion.ts` leen/escriben en Baserow vía `src/lib/baserow.ts` (Database Token). `replaceAllRows` para upload masivo. Paginación paralela + cache en memoria con TTLs altos (clientes/productos/vendedores 600s, listas_precio 300s, pedidos 20s) + edge cache HTTP (`s-maxage` en API routes).
2. **Form de pedido reescrito** — combobox de cliente, sin fecha de entrega ni transporte (lo carga el admin después), unidades como input primario (cajas y kg derivados de `unidades_por_caja` y `peso_promedio_kg`), "precio especial" en lugar de % descuento (alerta automática si difiere del precio de lista), un solo botón Confirmar con validación inline.
3. **Panel admin** — filtro por vendedor además de estado, botón "🖨 Imprimir lista" que imprime cada pedido como tarjeta con detalle de líneas (código, producto, unidades, cajas, kg, precio, subtotal, total), `page-break-inside: avoid`.
4. **Módulo Expedición** — nueva tab por defecto **"Pedidos por cliente"** (`ExpedicionPorCliente.tsx`) que agrupa pedidos por cliente y suma productos. Las planillas de elaboración/envasado/expedición/facturación quedaron como tabs secundarias.
5. **Upload masivo** — `/gestion/admin` con formulario para subir Excel/CSV de clientes, productos o lista de precios. Reemplazo total (clientes/productos) o parcial por lista (precios). Parser tolerante con tildes/mayúsculas/espacios. Usa lib `xlsx` (SheetJS).

**Convención Baserow**: el campo `id` está reservado por Baserow (es el row_id numérico interno). El id textual del dominio vive en `ext_id`. Los adaptadores en `data.ts` (`pedidoFromBR`, `clienteFromBR`, etc.) hacen el mapeo `ext_id → id` para que el resto de la app no note la diferencia. Single_select de Baserow llega como `{ value }` o string o null → usar helper `pickSelect()`. Los campos numéricos requieren `number_negative: true` al crearlos si pueden ser negativos.

**Pedidos viejos del Sheet NO se migraron** — decisión del usuario, se empieza desde cero con Baserow. El historial pre-cutover queda en el Sheet original como archivo.

**Pendientes que quedaron sugeridos**:
- Limpieza del código de fallback a Sheets en `data.ts` y `produccion.ts` (ahora que Baserow es autoritativo).
- Cache headers en `/api/produccion/*`.
- Vista "mis pedidos" del vendedor — verificar performance.
- Backup/export espejo del upload masivo.
- Revisar módulo Cobranzas.

## Qué es este proyecto

Sistema web para **Estancia de Oro S.A.** (productora de quesos y lácteos en Argentina). Reemplaza el formulario manual por WhatsApp que usaban los vendedores para tomar pedidos, y suma un back-office interno para administración.

- **URL producción**: https://estancia-de-oro.vercel.app
- **Repo**: https://github.com/dafinburg/estancia-de-oro
- **Sheet interno empresa** (no se toca desde esta app): Google Sheet V9.19 `1dOITCexSpDtm646V0tvMErky0MjqzjbfCFAMsf4SU1E` — sistema paralelo de producción/elaboración/stock.

## Plan de trabajo (3 etapas)

Según `Plan de trabajo.docx` en el root del proyecto padre:

1. **Etapa 1 ✅** — Formulario de toma de pedidos con validaciones.
2. **Etapa 2 (pendiente)** — Integración con ERP vía API para datos en tiempo real (saldos CC, stock).
3. **Etapa 3 (pendiente)** — Módulo de planificación de producción y logística.

## Arquitectura: dos apps en el mismo dominio

### 1. App de toma de pedidos (vendedores) — `/vendedor/*`

Simple, mobile-first. Los vendedores se loguean y ven sólo sus clientes asignados.

- `/vendedor` — listado de sus pedidos con filtros por estado
- `/vendedor/nuevo` — formulario de pedido (basado en template `FORMATO NOTA DE PEDIDO`)
- `/vendedor/pedido/[id]` — detalle + imprimir/PDF

### 2. Sistema de gestión interno (back-office) — `/gestion/*`

Sidebar lateral con 6 módulos:

- `/gestion` — Dashboard (KPIs: ventas, pedidos, deuda total, alertas)
- `/gestion/pedidos` — gestión completa con flujo pendiente → aprobado → enviado
- `/gestion/cobranzas` — saldos CC, clientes bloqueados (>$50k), ranking por provincia
- `/gestion/produccion` — **consolidado de pedidos por producto** (no es el sistema de producción interno — ese vive en el Sheet V9.19)
- `/gestion/clientes` — catálogo 2488 clientes con buscador y filtros
- `/gestion/productos` — catálogo con precios por lista

### Redirección por rol

Login en `/` → si rol es `admin` redirige a `/gestion`, si no a `/vendedor`. Rutas legacy `/pedidos` y `/admin` redirigen a las nuevas.

## Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS** (colores custom: `--verde-oscuro: #1a4731`, `--amarillo: #f5a623`)
- React Context para auth, sin librería de estado global
- Autenticación simple: usuario/password hardcodeado en `data/vendedores.json`, sesión en `localStorage`
- **Sin DB tradicional**: datos maestros en JSON, pedidos en Google Sheets vía Apps Script

## Modelo de datos

### Datos maestros (solo lectura en producción) — `/data/*.json`

- `vendedores.json` — 5 vendedores + admin
- `clientes.json` — **2488 clientes reales** del CSV `Clientes (1).csv`
- `productos.json` — **25 productos reales** alineados con lo que elabora la empresa (Cremoso, Tybo, Pategras, Fontina, Sardo, Gruyere Horma/Cuña, Mozzarella, Gouda, Provoleta, Reggianito, Port Salut, Roquefort, Criollo, Mantecas, DDL, Aderezos, Don Rogelio Cremoso, Crema de Leche, Recortes)
- `listas_precio.json` — **sólo "Lista General"** (placeholder, precios reales pendientes)
- `pedidos.json` — vacío en prod (los pedidos se persisten en Google Sheets)

Cada producto tiene un campo `nombre_produccion` que lo mapea al nombre interno del Sheet V9.19 (`CREMOSO`, `TYBO`, `PATEGRAS`, etc.) — útil si en el futuro se integra con el sistema de producción.

### Pedidos (persistencia dinámica)

- **Dev local**: se escriben a `data/pedidos.json`.
- **Vercel** (filesystem read-only): van al Google Sheet vía `GOOGLE_SHEETS_WEBHOOK_URL` (Apps Script deployado como Web App), que actúa también como tablero de control.

El cache en memoria (`globalThis.__pedidos_cache`) funciona como fallback dentro de una sesión de lambda, pero se pierde entre cold starts — por eso es crítico que el Apps Script esté configurado.

## Credenciales de prueba

| Usuario    | Password    | Rol      | Región                                 |
|------------|-------------|----------|----------------------------------------|
| `sjara`    | `1234`      | vendedor | Tucumán, Salta, Jujuy, Catamarca       |
| `mlopez`   | `1234`      | vendedor | Formosa, Chaco, Corrientes, Misiones   |
| `cmendoza` | `1234`      | vendedor | Santiago del Estero, La Rioja          |
| `jperez`   | `1234`      | vendedor | Buenos Aires, CABA                     |
| `agarcia`  | `1234`      | vendedor | Córdoba, Santa Fe, Entre Ríos, Mendoza |
| `admin`    | `admin2024` | admin    | Todas                                  |

## Comandos

```bash
# Desarrollo local
npm run dev                    # http://localhost:3000
npx next build                 # compilar (validar antes de push)

# Scripts de datos (python) — sólo si hay que regenerar desde Excel/CSV
python scripts/productos_reales.py       # regenera productos.json + listas_precio.json
python scripts/generate_data.py          # regenera clientes.json desde el CSV
python scripts/reassign_vendedores.py    # reasigna clientes a 5 vendedores por provincia

# Deploy
git push origin master         # GitHub (activa auto-deploy de Vercel)
vercel --yes --prod            # deploy manual a Vercel

# Si se pierde el alias del dominio limpio
vercel alias set <deployment-url> estancia-de-oro.vercel.app
```

## Estructura del código

```
estancia-de-oro/
├── data/                              # Datos maestros en JSON
├── docs/
│   ├── google-apps-script.md          # Guía paso a paso de la integración
│   └── apps-script-code.gs            # Código del Web App a pegar en Apps Script
├── scripts/                           # Python para regenerar JSONs desde Excel/CSV
├── src/
│   ├── app/
│   │   ├── api/                       # Route handlers de Next.js
│   │   │   ├── auth/                  # POST login
│   │   │   ├── clientes/              # GET (filtrable por IDs)
│   │   │   ├── vendedores/            # GET (sin passwords)
│   │   │   ├── productos/             # GET
│   │   │   ├── listas-precio/         # GET
│   │   │   └── pedidos/               # GET / POST / PATCH (webhook Sheets)
│   │   ├── vendedor/                  # App de toma de pedidos
│   │   ├── gestion/                   # Back-office con sidebar
│   │   ├── pedidos/                   # Legacy → redirige a /vendedor
│   │   ├── admin/                     # Legacy → redirige a /gestion
│   │   ├── layout.tsx
│   │   └── page.tsx                   # Login + redirect por rol
│   ├── components/
│   │   ├── VendedorShell.tsx          # Header simple mobile-first
│   │   ├── GestionShell.tsx           # Sidebar lateral con 6 módulos
│   │   ├── LoginForm.tsx
│   │   ├── FormularioPedido.tsx       # Formulario con validaciones
│   │   ├── ListadoPedidos.tsx         # Usado en /vendedor
│   │   ├── DetallePedido.tsx          # Detalle + imprimir/PDF
│   │   ├── PanelAdmin.tsx             # Usado en /gestion/pedidos
│   │   ├── DashboardGestion.tsx
│   │   ├── ModuloCobranzas.tsx
│   │   ├── ModuloProduccion.tsx       # Consolidado de pedidos (no ERP)
│   │   ├── ModuloClientes.tsx
│   │   ├── ModuloProductos.tsx
│   │   └── PanelValidaciones.tsx
│   ├── context/AuthContext.tsx
│   ├── lib/
│   │   ├── data.ts                    # Persistencia dual + normalizeFromSheet()
│   │   └── format.ts                  # formatCurrency, formatDate, generarNumeroPedido
│   └── types/index.ts                 # Vendedor, Cliente, Producto, LineaPedido, Pedido
├── README.md
└── CLAUDE.md                          # este archivo
```

## Lógica de validaciones (FormularioPedido)

Tres niveles con panel visual tipo semáforo:

1. **Campos obligatorios** — cliente, fecha entrega, ≥1 producto con cantidad > 0.
2. **Precio vs lista**:
   - Menor a lista → ⚠ warning con la diferencia
   - Igual o mayor → ✓ OK (puede ser precio especial)
   - 0 o negativo → ✗ bloquea
3. **Saldo cuenta corriente**:
   - ≥ 0 → ✓ OK
   - Entre $0 y -$50.000 → ⚠ modal de confirmación + nota automática en el pedido
   - < -$50.000 → ✗ bloqueado, requiere autorización

## Integración con Google Sheets (multi-sheet)

El Apps Script está en `docs/apps-script-code.gs`. Deployado como Web App (Execute as "Me", access "Anyone"), la URL se configura en Vercel como env var `GOOGLE_SHEETS_WEBHOOK_URL`.

### Hojas dentro del Sheet de pedidos

1. **Pedidos** — tablero de control en tiempo real (se llena vía POST desde la app)
2. **Clientes** — maestro editable por la empresa. La app lo lee en producción.
3. **Vendedores** — credenciales + `lista_precio_id` asignada a cada vendedor.
4. **ListasPrecio** — catálogo de listas (`id`, `nombre`).
5. **Precios** — `(lista_id, producto_id, precio)`. Tabla larga: una fila por producto dentro de cada lista. Agregar una lista nueva = agregar una fila en ListasPrecio + sus filas en Precios.
6. **ProductosMadre** — catálogo queso madre → hijos (CREMOSO → [CREMOSO, PORT SALUT]; PATEGRAS → [PATEGRAS, CRIOLLO, FONTINA]; etc.) con `cantidad_por_tina`.
7. **Elaboracion / ElaboracionHistorica** — planilla oficial del quesero: 44 columnas por tina (masa, litros, lote, temperaturas, pH, lotes de insumos, responsables de cada etapa, salmuera, subproductos).
8. **Envasado / EnvasadoHistorico** — lo que se envasa por día y lote (producto, lote_elab, cant_envasada, kilos, peso promedio, operario).
9. **Expedicion / ExpedicionHistorica** — preparación por cliente (cliente, producto, lote, unid/kilos preparados, operario).
10. **FacturacionProd / FacturacionProdHistorica** — cierre por cliente (cant_total, producto, kilos_total, peso promedio, flag facturado).

> Las hojas operativas (Elaboracion/Envasado/Expedicion/FacturacionProd) se cierran con `action: 'cerrar_planilla'` → las filas no-cerradas se mueven a su gemela histórica y quedan marcadas `cerrado=true`.

### Seed inicial

Una sola vez, después de deployar el Apps Script:

```bash
GOOGLE_SHEETS_WEBHOOK_URL="https://script.google.com/.../exec" node scripts/seed_sheets.mjs
```

Esto crea/repuebla las solapas Clientes, Vendedores, ListasPrecio, Precios y **ProductosMadre** con los datos de los JSON locales. Después la empresa edita ahí y la app lee del Sheet. Las 4 hojas operativas de producción (Elaboracion/Envasado/Expedicion/FacturacionProd) se crean al primer registro.

### Conceptos importantes

- **Los headers del Sheet se convierten en claves del JSON** que devuelve el Apps Script. `src/lib/data.ts` tiene `normalizeFromSheet()` (para pedidos), `normalizeCliente()` y `normalizeVendedor()` que traducen al modelo interno.
- **Vendedores: `.clientes` se reconstruye desde la hoja Clientes por `vendedor_id`** — no se guarda como array en el Sheet de Vendedores.
- Defensive rendering: todos los componentes que usan `estadoConfig[pedido.estado]` tienen fallback a `estadoConfig.pendiente` para no explotar si el estado viene fuera del enum.

## Listas de precio por vendedor

- Cada vendedor tiene `lista_precio_id`. Al loguearse, el formulario carga esa lista y aplica sus precios.
- Si el cliente tiene su propia `lista_precio_id` distinta, gana la del cliente (se recarga al seleccionarlo).
- **Descuento %** por línea en el formulario: el vendedor puede pedir autorización de un % de descuento. Se aplica sobre `precio_unitario` y se guarda en `LineaPedido.descuento_porcentaje` y `precio_bonificado`.

## Estados de cuenta del cliente

Campo opcional `estado_cuenta` en `Cliente`. Si no está seteado, se deriva del saldo:

| Saldo                | Estado automático | En formulario           |
|----------------------|-------------------|-------------------------|
| ≥ 0                  | `al_dia`          | Banner verde — pasa      |
| entre 0 y -$50.000   | `observado`       | Banner amarillo — avisa, requiere confirmación |
| < -$50.000           | `bloqueado`       | Banner rojo — no deja enviar, "hablar con administración" |

Desde `/gestion/cobranzas` se puede **sobreescribir manualmente** con un dropdown (al_dia / observado / bloqueado / auto). Se persiste en la columna `estado_cuenta` del Sheet.

## Módulo Producción (planilla oficial de elaboración)

`/gestion/produccion` ahora tiene **9 tabs** que replican la "PLANILLA ELABORACION OFICIAL" original (xlsx en el root del proyecto padre):

**Operativas** — se editan día a día y se cierran:
- **Planificación** — resumen agregado por producto según pedidos tomados (lo que había antes).
- **Elaboración** — 44 columnas por tina (masa madre → hijos, temperaturas, pH, insumos, salmuera). Dropdowns `masa` y `queso_1/2/3` leen de ProductosMadre.
- **Envasado**, **Expedición**, **Facturación** — formularios más chicos, mismas columnas que el xlsx.

**Históricas** — solo lectura: lo que quedó cerrado en semanas anteriores.

Arquitectura:
- `src/components/produccion/PlanillaGenerica.tsx` — componente genérico (tabla + modal de alta/edit + cerrar planilla). Cada tab define un array `campos: CampoPlanilla[]`.
- `src/lib/produccion.ts` — readers/writers contra Apps Script (o JSON local en dev).
- `src/app/api/produccion/[tipo]/route.ts` — CRUD genérico, `tipo` ∈ {elaboracion, envasado, expedicion, facturacion_prod}.
- `src/app/api/produccion/cerrar/route.ts` — cierre de planilla (mueve filas no-cerradas a la histórica).
- `src/app/api/produccion/productos-madre/route.ts` — catálogo madre/hijos.

Datos en dev: `/data/produccion/*.json` (se crean al guardar el primer registro).

## Edición de pedidos desde gestión

`/gestion/pedidos/[id]` muestra detalle completo + botón "Editar" que permite modificar: fecha entrega, dirección, transporte, condición pago, notas, y cada línea (cajas, cantidad, kg, precio, descuento %). Persiste vía `PATCH /api/pedidos` con `{id, cambios}`, que en producción escribe al Sheet mediante `action: 'update_full'`.

### Flujo de datos

```
Vendedor carga pedido en /vendedor/nuevo
       ↓
POST /api/pedidos (Next.js API route en Vercel)
       ↓
POST al Apps Script Web App
       ↓
Hoja "Pedidos" del Google Sheet (tablero de control en tiempo real)
       ↑
GET /api/pedidos lee del mismo Sheet → /gestion
```

### Dos Google Sheets distintos (NO confundir)

1. **Sheet de pedidos de la web** (`1HGYMBJxPQuee5jfZRdvH5aq04bCOD5O-R3RRU_ws5Ao`) — donde caen los pedidos que toman los vendedores. Esta app sí lo usa.
2. **Sheet interno V9.19 de producción** (`1dOITCexSpDtm646V0tvMErky0MjqzjbfCFAMsf4SU1E`) — sistema de elaboración, stock, rindes, expedición que ya usa la empresa. **Esta app NO lo toca** (decisión: sistema paralelo).

## Decisiones de arquitectura importantes

- **Sistema paralelo confirmado**: NO integrar con Sheet V9.19 de producción. La web maneja pedidos/clientes/cobranzas, y el Sheet de ellos sigue haciendo producción como hasta ahora. Si en Etapa 2 se integra, sería vía ERP, no leyendo del Sheet.
- **NO hay vinculación con Contabilium**. Contabilium es de La Delfina (otra empresa del mismo cliente). Cualquier referencia que aparezca es un bug.
- **Listas de precios de La Delfina eliminadas** (ARAMARK, COMEDORES, COOK MASTER, FOOD SERVICE, GRUPO L, SOUTH MANAGEMENT, COMEDORES NUEVOS). Sólo queda "Lista General" como placeholder — los precios reales los tiene que pasar el cliente.
- **Clientes reasignados por provincia** — el CSV original tenía todos los clientes en vendedor "1". Se reasignaron a 5 vendedores reales según región geográfica (ver `scripts/reassign_vendedores.py`).
- **Claves en snake_case en español** en el modelo interno (`razon_social`, `fecha_entrega`, `condicion_pago`) — respetando los términos del negocio.

## Convenciones

- Código y comentarios **en español**.
- **Voseo argentino** en UI (`"Ingresá"`, `"Agregá"`, `"Confirmá"`).
- Formato de moneda: `Intl.NumberFormat('es-AR')` con ARS.
- Fechas en UI: `dd/mm/yyyy` (se guardan ISO en datos).
- Número de pedido: `EDO-YYYYMMDD-XXX` (secuencial por día).

## Archivos de referencia en el proyecto padre

Ubicados en `H:/Mi unidad/MTR/Claude/estancia de oro/` (fuera del repo):

- `Plan de trabajo.docx` — las 3 etapas del proyecto
- `PLANILLA DE PEDIDOS PARA IMPRIMIR (2).xlsx` — template original en papel

En `C:/Users/HP/Downloads/`:

- `LISTADO DE ARTICULOS.xlsx` — productos maestros
- `Clientes (1).csv` — base de 2488 clientes reales
- `FORMATO NOTA DE PEDIDO (1).xlsx` — template del formulario digital
- `Tabla listas de precios_clientes.xlsx` — ⚠️ de **La Delfina**, NO de Estancia de Oro

## Próximos pasos sugeridos

- [ ] Cargar precios reales de Estancia de Oro en `data/listas_precio.json`
- [ ] Actualizar saldos CC reales en `data/clientes.json` (el CSV venía mayormente en $0)
- [ ] Generación del número de pedido en Apps Script (leyendo del Sheet) para garantizar unicidad entre cold starts de Vercel
- [ ] Etapa 2: integración con ERP para stock/saldos en tiempo real
- [ ] Etapa 3: módulo de logística/rutas de reparto (ya hay campos `zona` y `recorrido` en clientes)
- [ ] Notificaciones (WhatsApp/email) al vendedor cuando su pedido es aprobado
- [ ] Dashboard de KPIs por vendedor

## Cosas que NO romper

- El flujo de login/logout con redirect por rol. Si se modifica `AuthContext` o las shells, probar las 2 apps.
- El mapping `normalizeFromSheet()` en `src/lib/data.ts` — si se cambian los headers del Sheet, hay que actualizarlo.
- Los redirects legacy (`/pedidos`, `/admin`) — el cliente puede tenerlos bookmarkeados.
- La env var `GOOGLE_SHEETS_WEBHOOK_URL` en Vercel — sin ella los pedidos caen solo en memoria.
