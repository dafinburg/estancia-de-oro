"""
Genera productos reales de Estancia de Oro basados en:
- ESPEJO_ELABORACION: las masas/quesos que realmente elaboran
- PLANILLA STOCK: los productos que manejan de stock
- FORMATO NOTA DE PEDIDO: estructura (u/caja, kg aprox)
- LISTADO DE ARTICULOS: códigos maestros
"""
import json
import openpyxl

DOWNLOADS = "C:/Users/HP/Downloads"
OUT_DIR = "C:/estancia-de-oro/data"

# Productos reales que maneja la empresa (de PLANILLA STOCK + ELABORACION)
# Mapeados al código maestro del LISTADO DE ARTICULOS
# Estructura: (codigo, descripcion, unidades_por_caja, categoria, marca, nombre_produccion)
PRODUCTOS_REALES = [
    # === QUESOS ESTANCIA DE ORO — PASTA BLANDA ===
    ("311", "Queso Cremoso ESTANCIA DE ORO Horma", 4, "QUESOS PASTA BLANDA", "LA ESTANCIA DE ORO", "CREMOSO"),
    ("312", "Queso Por Salut ESTANCIA DE ORO Horma", 4, "QUESOS PASTA BLANDA", "LA ESTANCIA DE ORO", "PORT SALUT"),
    ("431", "Queso Roquefort ESTANCIA DE ORO Horma", 4, "QUESOS PASTA BLANDA", "LA ESTANCIA DE ORO", "ROQUEFORT"),
    # === SEMIDURA SIN OJOS ===
    ("321", "Queso Tybo ESTANCIA DE ORO Horma", 4, "QUESOS PASTA SEMIDURA SIN OJOS", "LA ESTANCIA DE ORO", "TYBO"),
    ("361", "Queso Mozzarella ESTANCIA DE ORO Horma", 4, "QUESOS PASTA SEMIDURA SIN OJOS", "LA ESTANCIA DE ORO", "MUZZARELLA"),
    ("340", "Queso Gouda ESTANCIA DE ORO Horma", 2, "QUESOS PASTA SEMIDURA SIN OJOS", "LA ESTANCIA DE ORO", "GOUDA"),
    # === SEMIDURA CON OJOS ===
    ("301", "Queso Gruyere ESTANCIA DE ORO Horma", 1, "QUESOS PASTA SEMIDURA CON OJOS", "LA ESTANCIA DE ORO", "GRUYERE HORMA"),
    ("341", "Queso Pategras ESTANCIA DE ORO Horma", 2, "QUESOS PASTA SEMIDURA CON OJOS", "LA ESTANCIA DE ORO", "PATEGRAS"),
    ("400", "Queso Criollo ESTANCIA DE ORO Horma", 2, "QUESOS PASTA SEMIDURA CON OJOS", "LA ESTANCIA DE ORO", "CRIOLLO"),
    ("351", "Queso Fontina ESTANCIA DE ORO Horma", 2, "QUESOS PASTA SEMIDURA CON OJOS", "LA ESTANCIA DE ORO", "FONTINA"),
    # === PASTA DURA ===
    ("402", "Queso Sardo ESTANCIA DE ORO Horma", 4, "QUESOS PASTA DURA", "LA ESTANCIA DE ORO", "SARDO"),
    ("421", "Queso Reggianito ESTANCIA DE ORO Horma", 2, "QUESOS PASTA DURA", "LA ESTANCIA DE ORO", "REGGIANITO"),
    ("411", "Queso Provoleta ESTANCIA DE ORO Horma", 2, "QUESOS PASTA DURA", "LA ESTANCIA DE ORO", "PROVOLETA"),
    # === PORCIONADOS ===
    ("302", "Queso Gruyere ESTANCIA DE ORO Cuña", 2, "QUESOS PORCIONADOS", "LA ESTANCIA DE ORO", "GRUYERE CUÑA"),
    # === MANTECAS ===
    ("943", "Manteca ESTANCIA DE ORO 100 GR Caja x 20 Unid.", 20, "MANTECAS", "LA ESTANCIA DE ORO", "MANTECA 100GR"),
    ("146", "Manteca ESTANCIA DE ORO 100 GR x Unidad", 1, "MANTECAS", "LA ESTANCIA DE ORO", "MANTECA 100GR"),
    ("941", "Manteca ESTANCIA DE ORO 200 GR Caja x 30 Unid.", 30, "MANTECAS", "LA ESTANCIA DE ORO", "MANTECA 200GR"),
    ("147", "Manteca ESTANCIA DE ORO 200 GR x Unidad", 1, "MANTECAS", "LA ESTANCIA DE ORO", "MANTECA 200GR"),
    # === DULCE DE LECHE ===
    ("100", "DDL X 400 GRS ESTANCIA DE ORO Caja x 12 Unid.", 12, "DULCE DE LECHE", "LA ESTANCIA DE ORO", "DULCE DE LECHE"),
    ("101", "DDL X 400 GRS ESTANCIA DE ORO x Unidad", 1, "DULCE DE LECHE", "LA ESTANCIA DE ORO", "DULCE DE LECHE"),
    # === ADEREZOS ===
    ("200", "Aderezo A Base De Queso Rallado x 40gr.", 1, "ADEREZOS", "LA ESTANCIA DE ORO", "ADEREZO"),
    ("201", "Aderezo A Base De Queso Rallado x 120gr.", 1, "ADEREZOS", "LA ESTANCIA DE ORO", "ADEREZO"),
    # === DON ROGELIO ===
    ("310", "Queso Cremoso DON ROGELIO Horma", 4, "QUESOS PASTA BLANDA", "DON ROGELIO", "CREMOSO DON ROGELIO"),
    # === GRANEL / OTROS ===
    ("500", "Crema de Leche x Kg", 1, "GRANEL", "LA ESTANCIA DE ORO", "CREMA DE LECHE x KG"),
    ("501", "Recortes x Kg", 1, "GRANEL", "LA ESTANCIA DE ORO", "RECORTES x KG"),
]

productos = []
for codigo, desc, upc, cat, marca, nombre_prod in PRODUCTOS_REALES:
    productos.append({
        "id": f"p{codigo}",
        "codigo": codigo,
        "descripcion": desc,
        "unidad": "unidad" if upc > 1 or "Unid" in desc else ("kg" if "x Kg" in desc or cat == "GRANEL" else "unidad"),
        "unidades_por_caja": upc,
        "categoria": cat,
        "marca": marca,
        "nombre_produccion": nombre_prod,  # nombre usado en el sistema de producción interno
        "activo": True,
    })

with open(f"{OUT_DIR}/productos.json", "w", encoding="utf-8") as f:
    json.dump(productos, f, ensure_ascii=False, indent=2)

print(f"Productos generados: {len(productos)}")

# === LISTA DE PRECIOS ÚNICA (Lista General) — sin listas de La Delfina ===
# Precios base en pesos argentinos (valores de referencia, editables)
precios_por_categoria = {
    "QUESOS PASTA BLANDA": 8500,
    "QUESOS PASTA SEMIDURA SIN OJOS": 9500,
    "QUESOS PASTA SEMIDURA CON OJOS": 11000,
    "QUESOS PASTA DURA": 13000,
    "QUESOS PORCIONADOS": 14500,
    "MANTECAS": 3200,
    "DULCE DE LECHE": 4800,
    "ADEREZOS": 2800,
    "GRANEL": 6000,
}

precios = []
for p in productos:
    precios.append({
        "producto_id": p["id"],
        "precio": precios_por_categoria.get(p["categoria"], 6000),
    })

listas = [
    {
        "id": "lp_general",
        "nombre": "Lista General",
        "precios": precios,
    }
]

with open(f"{OUT_DIR}/listas_precio.json", "w", encoding="utf-8") as f:
    json.dump(listas, f, ensure_ascii=False, indent=2)

print(f"Listas generadas: {len(listas)} (solo Lista General — sin listas de La Delfina)")
