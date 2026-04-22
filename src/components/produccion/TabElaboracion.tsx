'use client';

import { useEffect, useState } from 'react';
import PlanillaGenerica, { CampoPlanilla } from './PlanillaGenerica';
import { ProductoMadre } from '@/types';

export default function TabElaboracion({ hist = false }: { hist?: boolean }) {
  const [madres, setMadres] = useState<ProductoMadre[]>([]);

  useEffect(() => {
    fetch('/api/produccion/productos-madre')
      .then(r => r.json())
      .then(setMadres)
      .catch(() => setMadres([]));
  }, []);

  const opcionesMasa = madres.map(m => m.madre);
  const opcionesHijos = Array.from(new Set(madres.flatMap(m => m.hijos)));

  const campos: CampoPlanilla[] = [
    // Básicos
    { key: 'fecha', label: 'Fecha', tipo: 'date', grupo: 'Básicos' },
    { key: 'tina', label: 'Tina', tipo: 'number', grupo: 'Básicos' },
    { key: 'masa', label: 'Masa (madre)', tipo: 'select', opciones: opcionesMasa, grupo: 'Básicos' },
    { key: 'litros', label: 'Litros', tipo: 'number', grupo: 'Básicos' },
    { key: 'lote', label: 'Lote', grupo: 'Básicos' },
    { key: 'tina_fisica', label: 'Nº Tina Física', grupo: 'Básicos' },
    // Quesos hijos
    { key: 'cant_1', label: 'Cant 1', tipo: 'number', grupo: 'Quesos hijos' },
    { key: 'queso_1', label: 'Queso 1', tipo: 'select', opciones: opcionesHijos, grupo: 'Quesos hijos' },
    { key: 'cant_2', label: 'Cant 2', tipo: 'number', grupo: 'Quesos hijos' },
    { key: 'queso_2', label: 'Queso 2', tipo: 'select', opciones: opcionesHijos, grupo: 'Quesos hijos' },
    { key: 'cant_3', label: 'Cant 3', tipo: 'number', grupo: 'Quesos hijos' },
    { key: 'queso_3', label: 'Queso 3', tipo: 'select', opciones: opcionesHijos, grupo: 'Quesos hijos' },
    // Materia prima
    { key: 'desinf_inicial', label: 'Desinf. inicial', grupo: 'Materia prima' },
    { key: 'crema_kg', label: 'Crema (kg)', tipo: 'number', paso: 0.01, grupo: 'Materia prima' },
    { key: 'grasa_pct', label: 'Grasa %', grupo: 'Materia prima' },
    { key: 'proteina_pct', label: 'Proteína %', grupo: 'Materia prima' },
    { key: 'silo_fecha_almacenamiento', label: 'Silo / Fecha alm.', grupo: 'Materia prima' },
    // Proceso tina
    { key: 'hora_fermento', label: 'Hora agregado fermento', tipo: 'time', grupo: 'Proceso tina' },
    { key: 'hora_coag', label: 'Hora coag/floc', tipo: 'time', grupo: 'Proceso tina' },
    { key: 't_coagulacion', label: 'Tº coagulación', tipo: 'number', grupo: 'Proceso tina' },
    { key: 't_corte', label: 'Tº corte y agitación', grupo: 'Proceso tina' },
    { key: 't_coccion', label: 'Tº cocción', tipo: 'number', grupo: 'Proceso tina' },
    { key: 'ph_tina', label: 'pH/Acidez tina llena', grupo: 'Proceso tina' },
    // Insumos
    { key: 'cant_calcio', label: 'Cantidad Calcio', tipo: 'number', grupo: 'Insumos' },
    { key: 'lote_calcio', label: 'Lote Calcio', grupo: 'Insumos' },
    { key: 'cant_fermento', label: 'Cantidad Fermento', grupo: 'Insumos' },
    { key: 'lote_fermento', label: 'Rotac/Nº lote Fermento', grupo: 'Insumos' },
    { key: 'cant_colorante', label: 'Cantidad Colorante', grupo: 'Insumos' },
    { key: 'lote_colorante', label: 'Lote Colorante', grupo: 'Insumos' },
    { key: 'cant_coagulante', label: 'Cantidad Coagulante', grupo: 'Insumos' },
    { key: 'lote_coagulante', label: 'Lote Coagulante', grupo: 'Insumos' },
    // Moldeo
    { key: 'resp_quesero', label: 'Resp. Estand. y Quesero', grupo: 'Moldeo' },
    { key: 'hora_moldeo', label: 'Hora Moldeo', tipo: 'time', grupo: 'Moldeo' },
    { key: 'ph_moldeo', label: 'pH/Acidez al moldeo', grupo: 'Moldeo' },
    { key: 'resp_moldeo', label: 'Responsable Moldeo', grupo: 'Moldeo' },
    // Salmuera
    { key: 'salmuera_n', label: 'Salmuera Nº', grupo: 'Salmuera' },
    { key: 'densidad_salmuera', label: 'Densidad salmuera', grupo: 'Salmuera' },
    { key: 'temp_ingreso_salmuera', label: 'Tº ingreso salmuera', grupo: 'Salmuera' },
    { key: 'hora_ingreso_salmuera', label: 'Hora ingreso salm. (pH/Ac)', grupo: 'Salmuera' },
    { key: 'hora_salida_salmuera', label: 'Hora salida salmuera', tipo: 'time', grupo: 'Salmuera' },
    { key: 'resp_salmuera', label: 'Responsable Ingreso Salmuera', grupo: 'Salmuera' },
    // Otros
    { key: 'observaciones', label: 'Observaciones', grupo: 'Otros' },
    { key: 'subproductos', label: 'Subproductos', grupo: 'Otros' },
    { key: 'kg_subproductos', label: 'Kg subproductos', tipo: 'number', paso: 0.01, grupo: 'Otros' },
  ];

  const hoy = new Date().toISOString().split('T')[0];

  return (
    <PlanillaGenerica
      tipo="elaboracion"
      titulo="Elaboración (tinas)"
      campos={campos}
      defaultsExtra={{ fecha: hoy, cerrado: false }}
      hist={hist}
    />
  );
}
