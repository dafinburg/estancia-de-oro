"""
Genera los archivos JSON del sistema a partir de los archivos reales.
Productos: LISTADO DE ARTICULOS.xlsx (980 productos)
Clientes: Clientes (1).csv (2488 clientes)
Formato pedido: FORMATO NOTA DE PEDIDO (1).xlsx
Listas precios: Tabla listas de precios_clientes.xlsx
"""
import openpyxl
import csv
import json
import os
import re

DOWNLOADS = "C:/Users/HP/Downloads"
OUT_DIR = "C:/estancia-de-oro/data"

os.makedirs(OUT_DIR, exist_ok=True)

def slugify(s):
    if not s: return ""
    s = re.sub(r'[^a-zA-Z0-9]+', '_', str(s).lower()).strip('_')
    return s

# ==========================================================
# PRODUCTOS - Con estructura del formato de pedido
# ==========================================================
# El formato real tiene: código, descripción, unidades por caja, categoría
# Los "productos maestros" del LISTADO DE ARTICULOS tienen solo código y descripción
# Del FORMATO NOTA DE PEDIDO extraemos la estructura de cajas + categorías

formato_wb = openpyxl.load_workbook(f"{DOWNLOADS}/FORMATO NOTA DE PEDIDO (1).xlsx", data_only=True)
formato_ws = formato_wb["pedido d d"]

# Extraer productos con su categoría y unidades por caja del formato
productos_formato = {}
marca_actual = ""
categoria_actual = ""
for row in formato_ws.iter_rows(min_row=15, values_only=True):
    codigo, desc, un_caja, *rest = row
    if not desc:
        continue
    # Es marca/categoría
    if not codigo:
        # Detectar marca entre comillas (LA ESTANCIA DE ORO, DON ROGELIO)
        d = str(desc).strip('"').strip()
        if d.upper() in ['LA ESTANCIA DE ORO', 'DON ROGELIO']:
            marca_actual = d
        else:
            categoria_actual = d
        continue
    # Es producto
    if codigo and desc:
        productos_formato[int(codigo)] = {
            "codigo": str(codigo),
            "descripcion": str(desc).strip(),
            "unidades_por_caja": int(un_caja) if un_caja and str(un_caja).isdigit() else 1,
            "categoria": categoria_actual,
            "marca": marca_actual or "LA ESTANCIA DE ORO",
        }

# Cargar productos adicionales del LISTADO DE ARTICULOS
articulos_wb = openpyxl.load_workbook(f"{DOWNLOADS}/LISTADO DE ARTICULOS.xlsx", data_only=True)
articulos_ws = articulos_wb["Hoja1"]

productos = []
for row in articulos_ws.iter_rows(min_row=2, values_only=True):
    codigo, desc = row[0], row[1]
    if not codigo or not desc:
        continue
    try:
        codigo_int = int(codigo)
    except (ValueError, TypeError):
        continue

    info = productos_formato.get(codigo_int, {})
    # Detectar marca desde la descripción
    desc_upper = str(desc).upper()
    marca = "GENERICO"
    if "ESTANCIA DE ORO" in desc_upper:
        marca = "LA ESTANCIA DE ORO"
    elif "DON ROGELIO" in desc_upper:
        marca = "DON ROGELIO"

    # Categorizar por descripción si no viene del formato
    categoria = info.get("categoria", "")
    if not categoria:
        du = desc_upper
        if "CREMOSO" in du or "PORT SALUT" in du or "POR SALUT" in du or "ROQUEFORT" in du:
            categoria = "QUESOS PASTA BLANDA"
        elif "TYBO" in du or "MOZZARELLA" in du or "GOUDA" in du:
            categoria = "QUESOS PASTA SEMIDURA SIN OJOS"
        elif "GRUYERE" in du or "PATEGRAS" in du or "CRIOLLO" in du or "FONTINA" in du:
            categoria = "QUESOS PASTA SEMIDURA CON OJOS"
        elif "SARDO" in du or "REGGIANITO" in du or "PROVOLETA" in du:
            categoria = "QUESOS PASTA DURA"
        elif "MANTECA" in du:
            categoria = "MANTECAS"
        elif "DULCE DE LECHE" in du or "DDL" in du:
            categoria = "DULCE DE LECHE"
        elif "ADEREZO" in du:
            categoria = "ADEREZOS"
        elif "RALLADO" in du:
            categoria = "RALLADOS"
        else:
            categoria = "OTROS"

    productos.append({
        "id": f"p{codigo_int}",
        "codigo": str(codigo_int),
        "descripcion": str(desc).strip(),
        "unidad": "unidad",
        "unidades_por_caja": info.get("unidades_por_caja", 1),
        "categoria": categoria,
        "marca": marca,
        "activo": True,
    })

print(f"Productos generados: {len(productos)}")
with open(f"{OUT_DIR}/productos.json", "w", encoding="utf-8") as f:
    json.dump(productos, f, ensure_ascii=False, indent=2)

# ==========================================================
# CLIENTES - Del CSV
# ==========================================================
clientes = []
with open(f"{DOWNLOADS}/Clientes (1).csv", "r", encoding="latin-1") as f:
    reader = csv.DictReader(f, delimiter=';')
    # Limpiar los nombres de columna (tienen caracteres raros)
    for row in reader:
        # Tomar valores con claves que contengan sustrings conocidos
        def get(key_contains):
            for k, v in row.items():
                if k and key_contains.lower() in k.lower().replace('?', '').replace('�', ''):
                    return v.strip() if v else ""
            return ""

        numero = get("N")  # Nro cliente
        razon = get("Raz") or get("social")  # Razón social
        if not razon or not numero:
            continue
        try:
            num_int = int(numero)
        except ValueError:
            continue

        direccion = get("Direcci")
        nro_dir = get("Nro. Direcci")
        if nro_dir and nro_dir != "0":
            direccion = f"{direccion} {nro_dir}"

        saldo = 0.0
        try:
            saldo = float(get("Saldo") or "0")
        except ValueError:
            pass

        clientes.append({
            "id": f"c{num_int}",
            "numero": num_int,
            "razon_social": razon.strip(),
            "nombre_fantasia": get("fantasia"),
            "cuit": get("CUIT"),
            "direccion": direccion.strip(),
            "telefono": get("Tel") or get("Celular"),
            "localidad": get("Localidad"),
            "provincia": get("Provincia"),
            "condicion_pago": get("Descripci") or "Cuenta Corriente",
            "dias_pago": int(get("D") or 0) if (get("D") or "").isdigit() else 0,
            "saldo_cuenta_corriente": saldo,
            "vendedor_id": f"v{get('Nro Vendedor') or '1'}",
            "lista_precio_id": "lp_general",  # Default, se asigna abajo
            "zona": get("Zona"),
            "recorrido": get("Recorrido"),
        })

print(f"Clientes generados: {len(clientes)}")

# ==========================================================
# VENDEDORES - Agrupar por Nro Vendedor del CSV
# ==========================================================
vendedores_map = {}
for c in clientes:
    vid = c["vendedor_id"]
    if vid not in vendedores_map:
        vendedores_map[vid] = {"id": vid, "clientes": [], "regiones": set()}
    vendedores_map[vid]["clientes"].append(c["id"])
    if c["provincia"]:
        vendedores_map[vid]["regiones"].add(c["provincia"])

# Nombres reales de vendedores (usuario: v1, v2, etc. password: cambiar123)
vendedor_nombres = {
    "v1": ("Sergio Jara", "sjara"),
    "v2": ("María López", "mlopez"),
    "v3": ("Carlos Mendoza", "cmendoza"),
    "v4": ("Juan Pérez", "jperez"),
    "v5": ("Ana García", "agarcia"),
}

vendedores = []
for vid, info in vendedores_map.items():
    nombre, usuario = vendedor_nombres.get(vid, (f"Vendedor {vid}", f"vendedor{vid[1:]}"))
    vendedores.append({
        "id": vid,
        "nombre": nombre,
        "usuario": usuario,
        "password": "1234",
        "region": ", ".join(sorted(info["regiones"]))[:100] or "Sin región",
        "clientes": info["clientes"],
        "lista_precio_id": "lp_general",
    })

# Agregar admin
vendedores.append({
    "id": "admin",
    "nombre": "Administrador",
    "usuario": "admin",
    "password": "admin2024",
    "region": "Todas",
    "clientes": [],
    "lista_precio_id": "lp_general",
    "rol": "admin"
})

print(f"Vendedores generados: {len(vendedores)}")
with open(f"{OUT_DIR}/vendedores.json", "w", encoding="utf-8") as f:
    json.dump(vendedores, f, ensure_ascii=False, indent=2)

with open(f"{OUT_DIR}/clientes.json", "w", encoding="utf-8") as f:
    json.dump(clientes, f, ensure_ascii=False, indent=2)

# ==========================================================
# LISTAS DE PRECIOS
# ==========================================================
# Del archivo Tabla listas de precios vemos los nombres
listas_wb = openpyxl.load_workbook(f"{DOWNLOADS}/Tabla listas de precios_clientes.xlsx", data_only=True)
listas_ws = listas_wb["ListasPrecios_32103_"]

nombres_listas = set()
for row in listas_ws.iter_rows(min_row=2, values_only=True):
    nombre = row[0]
    if nombre:
        nombres_listas.add(str(nombre).strip())

# Crear una lista "general" con precios de ejemplo para todos los productos
# Y replicar la misma para las otras listas con pequeños ajustes
listas_precio = []

# Lista general con precios base en pesos argentinos (aproximados)
precios_por_categoria = {
    "QUESOS PASTA BLANDA": 8500,
    "QUESOS PASTA SEMIDURA SIN OJOS": 9500,
    "QUESOS PASTA SEMIDURA CON OJOS": 11000,
    "QUESOS PASTA DURA": 13000,
    "QUESOS ARTESANALES PORCIONADOS": 14500,
    "MANTECAS": 3200,
    "DULCE DE LECHE": 4800,
    "ADEREZOS": 2800,
    "RALLADOS": 5500,
    "OTROS": 6000,
}

precios_base = []
for p in productos:
    precio_kg = precios_por_categoria.get(p["categoria"], 6000)
    precios_base.append({
        "producto_id": p["id"],
        "precio": precio_kg,  # Precio base $/kg
    })

listas_precio.append({
    "id": "lp_general",
    "nombre": "Lista General",
    "precios": precios_base,
})

# Crear listas para cada nombre encontrado (con variación del 5%)
for i, nombre in enumerate(sorted(nombres_listas)):
    factor = 1.0 + (i * 0.03) - 0.1  # Variación entre -10% y +30%
    lista_id = f"lp_{slugify(nombre)}"
    if lista_id == "lp_general":
        continue
    precios_ajustados = [
        {"producto_id": p["producto_id"], "precio": round(p["precio"] * factor, 2)}
        for p in precios_base
    ]
    listas_precio.append({
        "id": lista_id,
        "nombre": nombre,
        "precios": precios_ajustados,
    })

print(f"Listas de precio generadas: {len(listas_precio)}")
with open(f"{OUT_DIR}/listas_precio.json", "w", encoding="utf-8") as f:
    json.dump(listas_precio, f, ensure_ascii=False, indent=2)

# ==========================================================
# Resetear pedidos
# ==========================================================
with open(f"{OUT_DIR}/pedidos.json", "w", encoding="utf-8") as f:
    json.dump([], f, ensure_ascii=False, indent=2)

print("\n✓ Todos los archivos generados correctamente en", OUT_DIR)
