/**
 * Estancia de Oro — API multi-sheet via Google Apps Script
 *
 * Deploy como Web App (execute as "Me", access "Anyone") y usar la URL
 * como GOOGLE_SHEETS_WEBHOOK_URL en Vercel.
 *
 * Hojas que usa este Apps Script:
 *   - Pedidos         → tablero de control de pedidos que toman los vendedores
 *   - Clientes        → maestro de clientes (editable por la empresa)
 *   - Vendedores      → maestro de vendedores + lista_precio_id asignada
 *   - ListasPrecio    → catálogo de listas (id + nombre)
 *   - Precios         → precios por (lista_id, producto_id)
 *
 * Acciones GET (doGet):
 *   ?action=list           → pedidos
 *   ?action=clientes       → maestro de clientes
 *   ?action=vendedores     → maestro de vendedores
 *   ?action=listas_precio  → todas las listas con sus precios embebidos
 *   ?action=precios&lista=lp_xxx → una lista específica con sus precios
 *
 * Acciones POST (doPost, body JSON):
 *   {action:'create', pedido}
 *   {action:'update_estado', id, estado}
 *   {action:'seed_clientes', clientes:[...]}         → inicializar hoja Clientes
 *   {action:'seed_vendedores', vendedores:[...]}     → inicializar hoja Vendedores
 *   {action:'seed_listas_precio', listas:[...]}      → inicializar ListasPrecio + Precios
 */

// -------- Constantes de hojas --------
const SHEET_PEDIDOS = 'Pedidos';
const SHEET_CLIENTES = 'Clientes';
const SHEET_VENDEDORES = 'Vendedores';
const SHEET_LISTAS = 'ListasPrecio';
const SHEET_PRECIOS = 'Precios';

// Producción / planilla oficial
const SHEET_PRODUCTOS_MADRE = 'ProductosMadre';
const SHEET_ELABORACION = 'Elaboracion';
const SHEET_ELABORACION_HIST = 'ElaboracionHistorica';
const SHEET_ENVASADO = 'Envasado';
const SHEET_ENVASADO_HIST = 'EnvasadoHistorico';
const SHEET_EXPEDICION = 'Expedicion';
const SHEET_EXPEDICION_HIST = 'ExpedicionHistorica';
const SHEET_FACTURACION_PROD = 'FacturacionProd';
const SHEET_FACTURACION_PROD_HIST = 'FacturacionProdHistorica';

// Headers de cada hoja (en orden)
const HDR_CLIENTES = [
  'id', 'numero', 'razon_social', 'nombre_fantasia', 'cuit',
  'direccion', 'localidad', 'provincia', 'telefono',
  'condicion_pago', 'dias_pago', 'saldo_cuenta_corriente',
  'lista_precio_id', 'vendedor_id', 'zona', 'recorrido',
  'estado_cuenta'
];
const HDR_VENDEDORES = [
  'id', 'nombre', 'usuario', 'password', 'region',
  'lista_precio_id', 'rol'
];
const HDR_LISTAS = ['id', 'nombre'];
const HDR_PRECIOS = ['lista_id', 'producto_id', 'precio'];

// --- Producción: Productos madre y sus hijos (queso madre → variantes hijas) ---
const HDR_PRODUCTOS_MADRE = ['madre', 'hijos', 'cantidad_por_tina'];

// --- Elaboración: columnas de la planilla oficial (quesería) ---
const HDR_ELABORACION = [
  'id', 'fecha', 'tina', 'masa', 'litros', 'lote',
  'cant_1', 'queso_1', 'cant_2', 'queso_2', 'cant_3', 'queso_3',
  'tina_fisica', 'desinf_inicial', 'crema_kg', 'grasa_pct', 'proteina_pct',
  'silo_fecha_almacenamiento', 'hora_fermento',
  'hora_coag', 't_coagulacion', 't_corte', 't_coccion', 'ph_tina',
  'cant_calcio', 'lote_calcio', 'cant_fermento', 'lote_fermento',
  'cant_colorante', 'lote_colorante', 'cant_coagulante', 'lote_coagulante',
  'resp_quesero', 'hora_moldeo', 'ph_moldeo', 'resp_moldeo',
  'salmuera_n', 'densidad_salmuera', 'temp_ingreso_salmuera',
  'hora_ingreso_salmuera', 'hora_salida_salmuera', 'resp_salmuera',
  'observaciones', 'subproductos', 'kg_subproductos',
  'cerrado'
];

// --- Envasado ---
const HDR_ENVASADO = [
  'id', 'fecha', 'producto', 'lote_elab', 'stock_disp',
  'cant_envasada', 'kilos_total', 'peso_promedio',
  'operario', 'unidades_turno', 'observaciones', 'cerrado'
];

// --- Expedición ---
const HDR_EXPEDICION = [
  'id', 'fecha', 'cliente', 'producto', 'lote',
  'stock_disp', 'unid_preparadas', 'kilos_preparados',
  'peso_promedio', 'operario', 'cerrado'
];

// --- Facturación (producción) ---
const HDR_FACTURACION_PROD = [
  'id', 'fecha', 'cliente', 'cant_total', 'producto',
  'kilos_total', 'peso_promedio', 'facturado', 'cerrado'
];

// ============================================================
// GET: dispatch por action
// ============================================================
function doGet(e) {
  const action = (e.parameter && e.parameter.action) || 'list';
  try {
    if (action === 'list')          return _json(getPedidos());
    if (action === 'clientes')      return _json(getClientes());
    if (action === 'vendedores')    return _json(getVendedores());
    if (action === 'listas_precio') return _json(getListasPrecio());
    if (action === 'precios') {
      const lista = e.parameter.lista;
      return _json(getListaPorId(lista));
    }
    // Producción
    if (action === 'productos_madre')  return _json(getProductosMadre());
    if (action === 'elaboraciones')    return _json(_readSheetAsObjects(SHEET_ELABORACION, HDR_ELABORACION));
    if (action === 'elaboraciones_hist') return _json(_readSheetAsObjects(SHEET_ELABORACION_HIST, HDR_ELABORACION));
    if (action === 'envasados')        return _json(_readSheetAsObjects(SHEET_ENVASADO, HDR_ENVASADO));
    if (action === 'envasados_hist')   return _json(_readSheetAsObjects(SHEET_ENVASADO_HIST, HDR_ENVASADO));
    if (action === 'expediciones')     return _json(_readSheetAsObjects(SHEET_EXPEDICION, HDR_EXPEDICION));
    if (action === 'expediciones_hist') return _json(_readSheetAsObjects(SHEET_EXPEDICION_HIST, HDR_EXPEDICION));
    if (action === 'facturaciones_prod')      return _json(_readSheetAsObjects(SHEET_FACTURACION_PROD, HDR_FACTURACION_PROD));
    if (action === 'facturaciones_prod_hist') return _json(_readSheetAsObjects(SHEET_FACTURACION_PROD_HIST, HDR_FACTURACION_PROD));
    return _json({ error: 'Acción desconocida: ' + action });
  } catch (err) {
    return _json({ error: String(err) });
  }
}

// ============================================================
// POST: dispatch por action
// ============================================================
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === 'create')              return _json(createPedido(body.pedido));
    if (action === 'update_estado')       return _json(updateEstado(body.id, body.estado));
    if (action === 'update_full')         return _json(updatePedidoFull(body.id, body.cambios || {}));
    if (action === 'seed_clientes')       return _json(seedClientes(body.clientes || []));
    if (action === 'seed_vendedores')     return _json(seedVendedores(body.vendedores || []));
    if (action === 'seed_listas_precio')  return _json(seedListasPrecio(body.listas || []));
    if (action === 'update_cliente_estado') return _json(updateClienteEstado(body.id, body.estado_cuenta));

    // Producción — CRUD genérico sobre las hojas
    if (action === 'seed_productos_madre') return _json(seedProductosMadre(body.productos || []));
    if (action === 'create_elaboracion')   return _json(_appendToSheet(SHEET_ELABORACION, HDR_ELABORACION, body.registro));
    if (action === 'update_elaboracion')   return _json(_updateRowById(SHEET_ELABORACION, HDR_ELABORACION, body.id, body.cambios || {}));
    if (action === 'delete_elaboracion')   return _json(_deleteRowById(SHEET_ELABORACION, HDR_ELABORACION, body.id));
    if (action === 'create_envasado')      return _json(_appendToSheet(SHEET_ENVASADO, HDR_ENVASADO, body.registro));
    if (action === 'update_envasado')      return _json(_updateRowById(SHEET_ENVASADO, HDR_ENVASADO, body.id, body.cambios || {}));
    if (action === 'delete_envasado')      return _json(_deleteRowById(SHEET_ENVASADO, HDR_ENVASADO, body.id));
    if (action === 'create_expedicion')    return _json(_appendToSheet(SHEET_EXPEDICION, HDR_EXPEDICION, body.registro));
    if (action === 'update_expedicion')    return _json(_updateRowById(SHEET_EXPEDICION, HDR_EXPEDICION, body.id, body.cambios || {}));
    if (action === 'delete_expedicion')    return _json(_deleteRowById(SHEET_EXPEDICION, HDR_EXPEDICION, body.id));
    if (action === 'create_facturacion_prod') return _json(_appendToSheet(SHEET_FACTURACION_PROD, HDR_FACTURACION_PROD, body.registro));
    if (action === 'update_facturacion_prod') return _json(_updateRowById(SHEET_FACTURACION_PROD, HDR_FACTURACION_PROD, body.id, body.cambios || {}));
    if (action === 'delete_facturacion_prod') return _json(_deleteRowById(SHEET_FACTURACION_PROD, HDR_FACTURACION_PROD, body.id));
    // Cierre de planilla: mueve filas no-cerradas a la histórica y las marca.
    if (action === 'cerrar_planilla')      return _json(cerrarPlanilla(body.tipo));

    return _json({ ok: false, error: 'Acción desconocida: ' + action });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

// ============================================================
// PEDIDOS
// ============================================================
function _ensurePedidos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_PEDIDOS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_PEDIDOS);
    sheet.appendRow([
      'ID', 'Número', 'Fecha pedido', 'Fecha entrega', 'Vendedor',
      'Cliente', 'Teléfono cliente', 'Condición pago',
      'Dirección entrega', 'Transporte', 'Tel. transporte',
      'Dir. transporte', 'Estado', 'Total',
      'Cajas', 'Unidades', 'Kg aprox',
      'Alertas', 'Notas', 'Detalle', 'Created At'
    ]);
    sheet.getRange(1, 1, 1, 21).setFontWeight('bold').setBackground('#1a4731').setFontColor('white');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getPedidos() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PEDIDOS);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    try { obj.lineas = obj['Detalle'] ? JSON.parse(obj['Detalle']) : []; } catch (e) { obj.lineas = []; }
    try { obj.alertas = obj['Alertas'] ? JSON.parse(obj['Alertas']) : []; } catch (e) { obj.alertas = []; }
    return obj;
  });
}

function createPedido(p) {
  const sheet = _ensurePedidos();
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
  return { ok: true };
}

function updateEstado(id, estado) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PEDIDOS);
  if (!sheet) return { ok: false, error: 'Hoja Pedidos no existe' };
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      sheet.getRange(i + 1, 13).setValue(estado); // columna "Estado"
      return { ok: true };
    }
  }
  return { ok: false, error: 'Pedido no encontrado' };
}

// Actualizar campos arbitrarios de un pedido (desde el back-office)
function updatePedidoFull(id, cambios) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PEDIDOS);
  if (!sheet) return { ok: false, error: 'Hoja Pedidos no existe' };
  const values = sheet.getDataRange().getValues();
  // Mapeo de campos del modelo interno → nombre de columna del header
  const colMap = {
    fecha_entrega: 'Fecha entrega',
    direccion_entrega: 'Dirección entrega',
    transportista: 'Transporte',
    telefono_transporte: 'Tel. transporte',
    direccion_transporte: 'Dir. transporte',
    condicion_pago: 'Condición pago',
    notas: 'Notas',
    estado: 'Estado',
    total: 'Total',
  };
  const headers = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] !== id) continue;
    Object.keys(cambios).forEach(k => {
      if (k === 'lineas' && Array.isArray(cambios.lineas)) {
        const col = headers.indexOf('Detalle');
        if (col !== -1) sheet.getRange(i + 1, col + 1).setValue(JSON.stringify(cambios.lineas));
        const cajas = cambios.lineas.reduce((s, l) => s + (l.cajas || 0), 0);
        const unidades = cambios.lineas.reduce((s, l) => s + (l.cantidad || 0), 0);
        const kg = cambios.lineas.reduce((s, l) => s + (l.kg_aprox || 0), 0);
        const cC = headers.indexOf('Cajas');
        const cU = headers.indexOf('Unidades');
        const cK = headers.indexOf('Kg aprox');
        if (cC !== -1) sheet.getRange(i + 1, cC + 1).setValue(cajas);
        if (cU !== -1) sheet.getRange(i + 1, cU + 1).setValue(unidades);
        if (cK !== -1) sheet.getRange(i + 1, cK + 1).setValue(kg);
        return;
      }
      if (k === 'alertas') {
        const col = headers.indexOf('Alertas');
        if (col !== -1) sheet.getRange(i + 1, col + 1).setValue(JSON.stringify(cambios.alertas || []));
        return;
      }
      const header = colMap[k];
      if (!header) return;
      const col = headers.indexOf(header);
      if (col !== -1) sheet.getRange(i + 1, col + 1).setValue(cambios[k]);
    });
    return { ok: true };
  }
  return { ok: false, error: 'Pedido no encontrado' };
}

// ============================================================
// CLIENTES
// ============================================================
function getClientes() {
  return _readSheetAsObjects(SHEET_CLIENTES, HDR_CLIENTES, (row) => {
    // Parseos numéricos
    row.numero = row.numero === '' ? undefined : Number(row.numero);
    row.dias_pago = row.dias_pago === '' ? undefined : Number(row.dias_pago);
    row.saldo_cuenta_corriente = Number(row.saldo_cuenta_corriente) || 0;
    return row;
  });
}

function updateClienteEstado(id, estado_cuenta) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CLIENTES);
  if (!sheet) return { ok: false, error: 'Hoja Clientes no existe' };
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const colId = headers.indexOf('id');
  const colEstado = headers.indexOf('estado_cuenta');
  if (colId === -1 || colEstado === -1) {
    return { ok: false, error: 'Columnas id / estado_cuenta no encontradas' };
  }
  for (let i = 1; i < values.length; i++) {
    if (values[i][colId] === id) {
      sheet.getRange(i + 1, colEstado + 1).setValue(estado_cuenta);
      return { ok: true };
    }
  }
  return { ok: false, error: 'Cliente no encontrado' };
}

function seedClientes(clientes) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_CLIENTES);
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet(SHEET_CLIENTES);
  sheet.appendRow(HDR_CLIENTES);
  sheet.getRange(1, 1, 1, HDR_CLIENTES.length)
    .setFontWeight('bold').setBackground('#1a4731').setFontColor('white');
  sheet.setFrozenRows(1);

  const rows = clientes.map(c => HDR_CLIENTES.map(h => {
    const v = c[h];
    return v === undefined || v === null ? '' : v;
  }));
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, HDR_CLIENTES.length).setValues(rows);
  }
  return { ok: true, total: clientes.length };
}

// ============================================================
// VENDEDORES
// ============================================================
function getVendedores() {
  return _readSheetAsObjects(SHEET_VENDEDORES, HDR_VENDEDORES, (row) => {
    if (!row.rol) delete row.rol;
    return row;
  });
}

function seedVendedores(vendedores) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_VENDEDORES);
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet(SHEET_VENDEDORES);
  sheet.appendRow(HDR_VENDEDORES);
  sheet.getRange(1, 1, 1, HDR_VENDEDORES.length)
    .setFontWeight('bold').setBackground('#1a4731').setFontColor('white');
  sheet.setFrozenRows(1);

  const rows = vendedores.map(v => HDR_VENDEDORES.map(h => {
    const val = v[h];
    return val === undefined || val === null ? '' : val;
  }));
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, HDR_VENDEDORES.length).setValues(rows);
  }
  return { ok: true, total: vendedores.length };
}

// ============================================================
// LISTAS DE PRECIO (dos hojas: ListasPrecio + Precios)
// ============================================================
function getListasPrecio() {
  const listas = _readSheetAsObjects(SHEET_LISTAS, HDR_LISTAS);
  const precios = _readSheetAsObjects(SHEET_PRECIOS, HDR_PRECIOS, (row) => {
    row.precio = Number(row.precio) || 0;
    return row;
  });
  // Agrupar precios por lista_id
  const byLista = {};
  precios.forEach(p => {
    if (!byLista[p.lista_id]) byLista[p.lista_id] = [];
    byLista[p.lista_id].push({ producto_id: p.producto_id, precio: p.precio });
  });
  return listas.map(l => ({
    id: l.id,
    nombre: l.nombre,
    precios: byLista[l.id] || []
  }));
}

function getListaPorId(listaId) {
  const todas = getListasPrecio();
  return todas.find(l => l.id === listaId) || null;
}

function seedListasPrecio(listas) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Hoja ListasPrecio
  let sL = ss.getSheetByName(SHEET_LISTAS);
  if (sL) ss.deleteSheet(sL);
  sL = ss.insertSheet(SHEET_LISTAS);
  sL.appendRow(HDR_LISTAS);
  sL.getRange(1, 1, 1, HDR_LISTAS.length)
    .setFontWeight('bold').setBackground('#1a4731').setFontColor('white');
  sL.setFrozenRows(1);
  const filasL = listas.map(l => [l.id, l.nombre]);
  if (filasL.length) sL.getRange(2, 1, filasL.length, HDR_LISTAS.length).setValues(filasL);

  // Hoja Precios
  let sP = ss.getSheetByName(SHEET_PRECIOS);
  if (sP) ss.deleteSheet(sP);
  sP = ss.insertSheet(SHEET_PRECIOS);
  sP.appendRow(HDR_PRECIOS);
  sP.getRange(1, 1, 1, HDR_PRECIOS.length)
    .setFontWeight('bold').setBackground('#1a4731').setFontColor('white');
  sP.setFrozenRows(1);
  const filasP = [];
  listas.forEach(l => {
    (l.precios || []).forEach(p => {
      filasP.push([l.id, p.producto_id, p.precio]);
    });
  });
  if (filasP.length) sP.getRange(2, 1, filasP.length, HDR_PRECIOS.length).setValues(filasP);

  return { ok: true, listas: listas.length, precios: filasP.length };
}

// ============================================================
// Helpers
// ============================================================
function _readSheetAsObjects(sheetName, expectedHeaders, transform) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      if (h) obj[String(h).trim()] = row[i];
    });
    return transform ? transform(obj) : obj;
  }).filter(o => o.id !== '' && o.id !== undefined && o.id !== null);
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// PRODUCCIÓN — helpers genéricos (append / update / delete)
// ============================================================
function _ensureSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold').setBackground('#1a4731').setFontColor('white');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function _appendToSheet(sheetName, headers, registro) {
  if (!registro) return { ok: false, error: 'Falta registro' };
  const sheet = _ensureSheet(sheetName, headers);
  if (!registro.id) registro.id = Utilities.getUuid();
  const row = headers.map(h => {
    const v = registro[h];
    if (v === undefined || v === null) return '';
    if (Array.isArray(v)) return v.join(',');
    return v;
  });
  sheet.appendRow(row);
  return { ok: true, id: registro.id };
}

function _updateRowById(sheetName, headers, id, cambios) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return { ok: false, error: 'Hoja ' + sheetName + ' no existe' };
  const values = sheet.getDataRange().getValues();
  const hdr = values[0];
  const colId = hdr.indexOf('id');
  if (colId === -1) return { ok: false, error: 'Columna id no encontrada' };
  for (let i = 1; i < values.length; i++) {
    if (values[i][colId] === id) {
      Object.keys(cambios).forEach(k => {
        const col = hdr.indexOf(k);
        if (col !== -1) {
          let v = cambios[k];
          if (Array.isArray(v)) v = v.join(',');
          sheet.getRange(i + 1, col + 1).setValue(v);
        }
      });
      return { ok: true };
    }
  }
  return { ok: false, error: 'Registro no encontrado' };
}

function _deleteRowById(sheetName, headers, id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return { ok: false, error: 'Hoja no existe' };
  const values = sheet.getDataRange().getValues();
  const hdr = values[0];
  const colId = hdr.indexOf('id');
  for (let i = 1; i < values.length; i++) {
    if (values[i][colId] === id) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { ok: false, error: 'Registro no encontrado' };
}

// ============================================================
// PRODUCTOS MADRE
// ============================================================
function getProductosMadre() {
  return _readSheetAsObjects(SHEET_PRODUCTOS_MADRE, HDR_PRODUCTOS_MADRE, (row) => ({
    madre: row.madre,
    hijos: String(row.hijos || '').split(',').map(s => s.trim()).filter(Boolean),
    cantidad_por_tina: Number(row.cantidad_por_tina) || 1,
  })).filter(p => p.madre);
}

function seedProductosMadre(productos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_PRODUCTOS_MADRE);
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet(SHEET_PRODUCTOS_MADRE);
  sheet.appendRow(HDR_PRODUCTOS_MADRE);
  sheet.getRange(1, 1, 1, HDR_PRODUCTOS_MADRE.length)
    .setFontWeight('bold').setBackground('#1a4731').setFontColor('white');
  sheet.setFrozenRows(1);
  const rows = productos.map(p => [
    p.madre,
    Array.isArray(p.hijos) ? p.hijos.join(',') : (p.hijos || ''),
    p.cantidad_por_tina || 1
  ]);
  if (rows.length) sheet.getRange(2, 1, rows.length, HDR_PRODUCTOS_MADRE.length).setValues(rows);
  return { ok: true, total: productos.length };
}

// ============================================================
// Cierre de planilla — mueve filas no-cerradas a la histórica
// tipo: 'elaboracion' | 'envasado' | 'expedicion' | 'facturacion_prod'
// ============================================================
function cerrarPlanilla(tipo) {
  const map = {
    elaboracion:      { op: SHEET_ELABORACION,      hist: SHEET_ELABORACION_HIST,      hdr: HDR_ELABORACION },
    envasado:         { op: SHEET_ENVASADO,         hist: SHEET_ENVASADO_HIST,         hdr: HDR_ENVASADO },
    expedicion:       { op: SHEET_EXPEDICION,       hist: SHEET_EXPEDICION_HIST,       hdr: HDR_EXPEDICION },
    facturacion_prod: { op: SHEET_FACTURACION_PROD, hist: SHEET_FACTURACION_PROD_HIST, hdr: HDR_FACTURACION_PROD },
  };
  const cfg = map[tipo];
  if (!cfg) return { ok: false, error: 'tipo inválido' };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const op = ss.getSheetByName(cfg.op);
  if (!op) return { ok: false, error: 'Hoja operativa no existe' };
  const hist = _ensureSheet(cfg.hist, cfg.hdr);

  const values = op.getDataRange().getValues();
  if (values.length < 2) return { ok: true, movidas: 0 };
  const hdr = values[0];
  const colCerrado = hdr.indexOf('cerrado');
  const rowsMover = [];
  const filasBorrar = [];
  for (let i = 1; i < values.length; i++) {
    const cerrado = colCerrado !== -1 ? values[i][colCerrado] : '';
    if (cerrado === true || cerrado === 'TRUE' || cerrado === 'true' || cerrado === 1) continue;
    if (!values[i].some(c => c !== '' && c !== null)) continue;
    const copia = values[i].slice();
    if (colCerrado !== -1) copia[colCerrado] = true;
    rowsMover.push(copia);
    filasBorrar.push(i + 1);
  }
  if (rowsMover.length) {
    hist.getRange(hist.getLastRow() + 1, 1, rowsMover.length, rowsMover[0].length).setValues(rowsMover);
    // borrar desde abajo
    filasBorrar.sort((a, b) => b - a).forEach(r => op.deleteRow(r));
  }
  return { ok: true, movidas: rowsMover.length };
}
