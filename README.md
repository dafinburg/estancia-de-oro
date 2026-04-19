# Estancia de Oro — Sistema de Gestión de Pedidos

Sistema web para la gestión de pedidos de **Estancia de Oro**, empresa productora de quesos y lácteos en Argentina. Reemplaza el formulario manual de WhatsApp por un sistema web estructurado con validaciones automáticas, integrado con Google Sheets como tablero de control.

## Demo / Deploy

- **Producción**: https://estancia-de-oro.vercel.app _(a configurar)_
- **Repositorio**: https://github.com/<usuario>/estancia-de-oro _(a configurar)_

## Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS**
- **Datos maestros**: archivos JSON en `/data` (solo lectura en producción — compatible con Vercel)
- **Pedidos**: Google Sheets vía Apps Script como backend (tablero de control en tiempo real)

## Datos reales cargados

- **23 productos** de `LISTADO DE ARTICULOS.xlsx` (Quesos Pasta Blanda/Semidura/Dura, Mantecas, Dulce de Leche, Aderezos)
- **2488 clientes** reales de `Clientes (1).csv` distribuidos por provincia
- **8 listas de precios** (General + ARAMARK, COMEDORES, COMEDORES NUEVOS, COOK MASTER, FOOD SERVICE, GRUPO L, SOUTH MANAGEMENT)
- **5 vendedores** asignados geográficamente:

| Vendedor          | Usuario    | Password | Región                                |
| ----------------- | ---------- | -------- | ------------------------------------- |
| Sergio Jara       | sjara      | 1234     | Tucumán, Salta, Jujuy, Catamarca      |
| María López       | mlopez     | 1234     | Formosa, Chaco, Corrientes, Misiones  |
| Carlos Mendoza    | cmendoza   | 1234     | Santiago del Estero, La Rioja         |
| Juan Pérez        | jperez     | 1234     | Buenos Aires, CABA                    |
| Ana García        | agarcia    | 1234     | Córdoba, Santa Fe, Entre Ríos, Mendoza|
| **Administrador** | **admin**  | **admin2024** | Todas                         |

## Instalación local

```bash
git clone <repo-url>
cd estancia-de-oro
npm install
npm run dev
```

Abrir http://localhost:3000

## Funcionalidades

### Formulario de Pedido (basado en "NOTA DE PEDIDO" real)

- **Datos**: Fecha, Fecha de entrega, Vendedor (auto)
- **Cliente**: Buscador con filtro por razón social / CUIT / localidad sobre 2488 clientes; muestra teléfono, dirección, condición de pago, saldo cuenta corriente
- **Transporte**: Nombre, teléfono (con prefijo), dirección re-despacho, dirección entrega
- **Productos**: Tabla con columnas Código, Producto (agrupados por categoría), U/Caja, Cajas, Unidades, Kg aprox, $ x Kg/U, Subtotal
- **Totales**: Cajas, Unidades, Kg, Importe

### Validaciones automáticas

1. **Campos obligatorios**: cliente, fecha entrega, ≥1 producto con cantidad
2. **Precios**: compara con la lista del cliente
   - Menor a lista → ⚠ amarillo con diferencia
   - Igual o mayor → ✓ verde
   - Cero o negativo → ✗ bloquea
3. **Saldo en cuenta corriente**:
   - 0 o positivo → ✓ verde
   - Vencido entre $0 y $50.000 → ⚠ modal confirmación + nota automática en el pedido
   - Vencido > $50.000 → ✗ bloqueado (requiere autorización)

### Gestión de pedidos

- Listado filtrable por estado (pendiente / aprobado / enviado)
- Detalle completo con botón Imprimir / PDF (estilos print-specific)
- Número de pedido con formato `EDO-YYYYMMDD-XXX`

### Panel de administración

- Tarjetas con totales: Total pedidos, Pendientes, Aprobados, Con alertas
- Lista de alertas pendientes de revisión
- Tabla de todos los pedidos con cambio de estado (pendiente → aprobado → enviado)

## Deploy a Vercel

### 1. Push a GitHub

```bash
gh repo create estancia-de-oro --public --source=. --push
```

### 2. Conectar a Vercel

- Importar el repo en https://vercel.com/new
- Deploy (usa la config por defecto de Next.js)

### 3. Configurar Google Sheets como backend de pedidos

Seguir la guía completa en [`docs/google-apps-script.md`](docs/google-apps-script.md).

Resumen:
1. Abrir el Google Sheet https://docs.google.com/spreadsheets/d/1HGYMBJxPQuee5jfZRdvH5aq04bCOD5O-R3RRU_ws5Ao
2. Extensiones → Apps Script → pegar `docs/apps-script-code.gs`
3. Deploy como Web App → copiar URL
4. En Vercel, agregar env var: `GOOGLE_SHEETS_WEBHOOK_URL` = URL del Apps Script
5. Redeploy

A partir de ese momento cada pedido confirmado se registra automáticamente en la hoja "Pedidos" del Google Sheet, que sirve como tablero de control en tiempo real.

## Estructura del Proyecto

```
estancia-de-oro/
├── data/                    # Datos maestros en JSON (solo lectura en prod)
│   ├── vendedores.json      # 5 vendedores + admin
│   ├── clientes.json        # 2488 clientes reales
│   ├── productos.json       # 23 productos con código, categoría, marca
│   ├── listas_precio.json   # 8 listas de precios
│   └── pedidos.json         # Vacío (solo dev; en prod va a Google Sheets)
├── docs/
│   ├── google-apps-script.md    # Guía de configuración
│   └── apps-script-code.gs      # Código a pegar en Google Apps Script
├── scripts/                 # Scripts Python para regenerar JSONs desde Excel/CSV
│   ├── generate_data.py
│   └── reassign_vendedores.py
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/        # POST login
│   │   │   ├── clientes/    # GET filtrado por vendedor
│   │   │   ├── listas-precio/
│   │   │   ├── pedidos/     # GET/POST/PATCH (Google Sheets webhook en prod)
│   │   │   └── productos/
│   │   ├── admin/           # Panel de administración
│   │   ├── pedidos/
│   │   │   ├── nuevo/
│   │   │   └── [id]/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── AppShell.tsx
│   │   ├── FormularioPedido.tsx
│   │   ├── Header.tsx
│   │   ├── LoginForm.tsx
│   │   ├── ListadoPedidos.tsx
│   │   ├── DetallePedido.tsx
│   │   ├── PanelAdmin.tsx
│   │   └── PanelValidaciones.tsx
│   ├── context/AuthContext.tsx
│   ├── lib/
│   │   ├── data.ts          # Capa persistencia (dual: JSON local / Sheets)
│   │   └── format.ts
│   └── types/index.ts
└── README.md
```

## Arquitectura de datos

### Desarrollo (local)

```
/data/*.json ←→ API Routes ←→ UI
```

### Producción (Vercel)

```
                          ┌─→ /data/*.json (read-only, datos maestros)
Vercel Functions ────────→┤
                          └─→ Google Apps Script → Google Sheets (pedidos)
                                                         ↑
                                                  Tablero de control
                                                  (en tiempo real)
```

## Próximos pasos / Roadmap

- [ ] Integración con ERP para saldos CC en tiempo real
- [ ] Exportación del pedido a PDF con el formato original de la empresa
- [ ] Notificación por WhatsApp / Email cuando admin aprueba pedido
- [ ] Módulo de productos en promoción
- [ ] Dashboard de KPIs por vendedor
