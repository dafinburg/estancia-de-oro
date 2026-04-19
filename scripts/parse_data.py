"""
Script para parsear los archivos Excel y CSV con datos reales
de Estancia de Oro y generar los JSON del sistema.
"""
import openpyxl
import csv
import json
import os
from collections import defaultdict

DOWNLOADS = "C:/Users/HP/Downloads"
OUT_DIR = "C:/estancia-de-oro/data"

# ---------- 1. PRODUCTOS ----------
print("=" * 60)
print("1. LISTADO DE ARTICULOS")
print("=" * 60)
wb = openpyxl.load_workbook(f"{DOWNLOADS}/LISTADO DE ARTICULOS.xlsx", data_only=True)
for sheet_name in wb.sheetnames:
    print(f"Sheet: {sheet_name}")
    ws = wb[sheet_name]
    print(f"  Dimensions: {ws.max_row} rows x {ws.max_column} cols")
    # Mostrar las primeras 5 filas
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i < 5:
            print(f"  Row {i}: {row}")
        else:
            break

# ---------- 2. FORMATO NOTA DE PEDIDO ----------
print("\n" + "=" * 60)
print("2. FORMATO NOTA DE PEDIDO")
print("=" * 60)
wb2 = openpyxl.load_workbook(f"{DOWNLOADS}/FORMATO NOTA DE PEDIDO (1).xlsx", data_only=True)
for sheet_name in wb2.sheetnames:
    print(f"Sheet: {sheet_name}")
    ws = wb2[sheet_name]
    print(f"  Dimensions: {ws.max_row} rows x {ws.max_column} cols")
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i < 30:
            print(f"  Row {i}: {row}")
        else:
            break

# ---------- 3. TABLA LISTAS DE PRECIOS ----------
print("\n" + "=" * 60)
print("3. Tabla listas de precios_clientes")
print("=" * 60)
wb3 = openpyxl.load_workbook(f"{DOWNLOADS}/Tabla listas de precios_clientes.xlsx", data_only=True)
for sheet_name in wb3.sheetnames:
    print(f"Sheet: {sheet_name}")
    ws = wb3[sheet_name]
    print(f"  Dimensions: {ws.max_row} rows x {ws.max_column} cols")
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i < 5:
            print(f"  Row {i}: {row}")
        else:
            break
