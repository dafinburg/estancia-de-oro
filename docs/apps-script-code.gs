/**
 * Estancia de Oro — API de Pedidos via Google Apps Script
 *
 * Deploy como Web App (execute as "Me", access "Anyone") y usar la URL
 * como GOOGLE_SHEETS_WEBHOOK_URL en Vercel.
 */

const SHEET_NAME = 'Pedidos';

// Columnas en el orden del header de la hoja
const COLS = [
  'id', 'numero', 'fecha_pedido', 'fecha_entrega', 'vendedor_nombre',
  'cliente_razon_social', 'cliente_telefono', 'condicion_pago',
  'direccion_entrega', 'transportista', 'telefono_transporte',
  'direccion_transporte', 'estado', 'total',
  'cajas_total', 'unidades_total', 'kg_total',
  'alertas', 'notas', 'detalle', 'created_at'
];

// GET: devolver todos los pedidos (para lectura desde la app)
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return _json([]);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return _json([]);
  const headers = values[0];
  const pedidos = values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    // Parsear detalle (JSON string) y alertas
    try { obj.lineas = obj.detalle ? JSON.parse(obj.detalle) : []; } catch (err) { obj.lineas = []; }
    try { obj.alertas = obj.alertas ? JSON.parse(obj.alertas) : []; } catch (err) { obj.alertas = []; }
    return obj;
  });
  return _json(pedidos);
}

// POST: crear pedido o actualizar estado
function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'ID', 'Número', 'Fecha pedido', 'Fecha entrega', 'Vendedor',
      'Cliente', 'Teléfono cliente', 'Condición pago',
      'Dirección entrega', 'Transporte', 'Tel. transporte',
      'Dir. transporte', 'Estado', 'Total',
      'Cajas', 'Unidades', 'Kg aprox',
      'Alertas', 'Notas', 'Detalle', 'Created At'
    ]);
    sheet.getRange(1, 1, 1, COLS.length).setFontWeight('bold').setBackground('#1a4731').setFontColor('white');
    sheet.setFrozenRows(1);
  }

  if (body.action === 'create') {
    const p = body.pedido;
    const cajas = (p.lineas || []).reduce((s, l) => s + (l.cajas || 0), 0);
    const unidades = (p.lineas || []).reduce((s, l) => s + (l.cantidad || 0), 0);
    const kg = (p.lineas || []).reduce((s, l) => s + (l.kg_aprox || 0), 0);
    sheet.appendRow([
      p.id, p.numero, p.fecha_pedido, p.fecha_entrega, p.vendedor_nombre,
      p.cliente_razon_social, p.cliente_telefono || '', p.condicion_pago || '',
      p.direccion_entrega, p.transportista || '', p.telefono_transporte || '',
      p.direccion_transporte || '', p.estado, p.total,
      cajas, unidades, kg,
      JSON.stringify(p.alertas || []),
      p.notas || '',
      JSON.stringify(p.lineas || []),
      p.created_at
    ]);
    return _json({ ok: true });
  }

  if (body.action === 'update_estado') {
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === body.id) {
        sheet.getRange(i + 1, 13).setValue(body.estado); // columna "Estado"
        return _json({ ok: true });
      }
    }
    return _json({ ok: false, error: 'Pedido no encontrado' });
  }

  return _json({ ok: false, error: 'Acción desconocida' });
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
