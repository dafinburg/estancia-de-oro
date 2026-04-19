"""Reasignar clientes a 5 vendedores reales por región"""
import json

with open("C:/estancia-de-oro/data/clientes.json", "r", encoding="utf-8") as f:
    clientes = json.load(f)

# Definir vendedores reales con región de referencia
vendedores_reales = [
    {"id": "v001", "nombre": "Sergio Jara", "usuario": "sjara", "password": "1234",
     "regiones": ["TUCUMAN", "SALTA", "JUJUY", "CATAMARCA"]},
    {"id": "v002", "nombre": "María López", "usuario": "mlopez", "password": "1234",
     "regiones": ["FORMOSA", "CHACO", "CORRIENTES", "MISIONES"]},
    {"id": "v003", "nombre": "Carlos Mendoza", "usuario": "cmendoza", "password": "1234",
     "regiones": ["SANTIAGO DEL ESTERO", "LA RIOJA"]},
    {"id": "v004", "nombre": "Juan Pérez", "usuario": "jperez", "password": "1234",
     "regiones": ["BUENOS AIRES", "CAPITAL FEDERAL", "CABA"]},
    {"id": "v005", "nombre": "Ana García", "usuario": "agarcia", "password": "1234",
     "regiones": ["CORDOBA", "SANTA FE", "ENTRE RIOS", "MENDOZA", "SAN LUIS", "SAN JUAN"]},
]

# Asignar cada cliente al vendedor según su provincia
def get_vendedor(cliente):
    prov = (cliente.get("provincia") or "").upper().strip()
    for v in vendedores_reales:
        if any(r in prov for r in v["regiones"]):
            return v["id"]
    # Sin provincia o no coincide → distribuir por ID cliente
    idx = cliente.get("numero", 0) % len(vendedores_reales)
    return vendedores_reales[idx]["id"]

# Reasignar
clientes_por_vendedor = {v["id"]: [] for v in vendedores_reales}
for c in clientes:
    vid = get_vendedor(c)
    c["vendedor_id"] = vid
    clientes_por_vendedor[vid].append(c["id"])

# Crear JSON de vendedores final
vendedores_out = []
for v in vendedores_reales:
    vendedores_out.append({
        "id": v["id"],
        "nombre": v["nombre"],
        "usuario": v["usuario"],
        "password": v["password"],
        "region": ", ".join(v["regiones"][:3]),
        "clientes": clientes_por_vendedor[v["id"]],
        "lista_precio_id": "lp_general",
    })
    print(f"{v['nombre']}: {len(clientes_por_vendedor[v['id']])} clientes")

vendedores_out.append({
    "id": "admin",
    "nombre": "Administrador",
    "usuario": "admin",
    "password": "admin2024",
    "region": "Todas",
    "clientes": [],
    "lista_precio_id": "lp_general",
    "rol": "admin"
})

with open("C:/estancia-de-oro/data/vendedores.json", "w", encoding="utf-8") as f:
    json.dump(vendedores_out, f, ensure_ascii=False, indent=2)

with open("C:/estancia-de-oro/data/clientes.json", "w", encoding="utf-8") as f:
    json.dump(clientes, f, ensure_ascii=False, indent=2)

print(f"\nTotal clientes: {len(clientes)}")
print(f"Total vendedores: {len(vendedores_out)}")
