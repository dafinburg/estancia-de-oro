# Integración con Google Sheets — Tablero de Control

El sistema envía cada pedido confirmado al Google Sheet configurado como tablero de control en tiempo real.

## Configuración en 5 pasos

### 1. Abrir el Google Sheet y crear las hojas necesarias

En el Google Sheet https://docs.google.com/spreadsheets/d/1HGYMBJxPQuee5jfZRdvH5aq04bCOD5O-R3RRU_ws5Ao crear una hoja llamada **"Pedidos"** con los siguientes headers en la fila 1:

```
ID | Número | Fecha pedido | Fecha entrega | Vendedor | Cliente | Teléfono cliente | Condición pago | Dirección entrega | Transporte | Tel. transporte | Dir. transporte | Estado | Total | Cajas | Unidades | Kg aprox | Alertas | Notas | Detalle | Created At
```

### 2. Crear el Apps Script

1. En el Google Sheet: menú **Extensiones → Apps Script**
2. Borrar el contenido y pegar el código de `/docs/apps-script-code.gs`
3. Guardar (Ctrl+S) y nombrar el proyecto: "Estancia de Oro — API Pedidos"

### 3. Deployar como Web App

1. Click en **Deploy → New deployment**
2. Type: **Web app**
3. Configurar:
   - Description: `API de pedidos`
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click en **Deploy**
5. Autorizar los permisos
6. **Copiar la URL del Web App** (termina en `/exec`)

### 4. Configurar la variable de entorno en Vercel

1. En el dashboard de Vercel, ir al proyecto → Settings → Environment Variables
2. Agregar:
   - Name: `GOOGLE_SHEETS_WEBHOOK_URL`
   - Value: la URL copiada en el paso 3
3. Redeploy

### 5. ¡Listo!

A partir de ahora cada pedido confirmado se registrará automáticamente en la hoja Pedidos del Google Sheet.
