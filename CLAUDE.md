# CLAUDE.md

Contexto para Claude Code cuando trabaje en este proyecto. Actualizar cuando la arquitectura cambie.

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

## Integración con Google Sheets

El Apps Script está en `docs/apps-script-code.gs`. Deployado como Web App (Execute as "Me", access "Anyone"), la URL se configura en Vercel como env var `GOOGLE_SHEETS_WEBHOOK_URL`.

### Conceptos importantes

- **Los headers del Sheet se convierten en claves del JSON** que devuelve el Apps Script (`"Estado"`, `"Número"`, `"Detalle"`, etc.) — por eso `src/lib/data.ts` tiene la función `normalizeFromSheet()` que traduce esas claves al modelo interno (`estado`, `numero`, `lineas`).
- Defensive rendering: todos los componentes que usan `estadoConfig[pedido.estado]` tienen fallback a `estadoConfig.pendiente` para no explotar si el estado viene fuera del enum.

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
