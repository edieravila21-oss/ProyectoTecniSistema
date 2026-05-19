const checklistNevera = [
  { categoria: 'llegada', descripcion: 'Tomar foto del equipo antes del servicio', orden: 1 },
  { categoria: 'llegada', descripcion: 'Confirmar modelo y serial del equipo', orden: 2 },
  { categoria: 'diagnostico', descripcion: 'Verificar voltaje de entrada', orden: 3 },
  { categoria: 'diagnostico', descripcion: 'Revisar estado del compresor', orden: 4 },
  { categoria: 'diagnostico', descripcion: 'Revisar nivel de gas refrigerante (R-134a o R-600a)', orden: 5 },
  { categoria: 'diagnostico', descripcion: 'Revisar termostato', orden: 6 },
  { categoria: 'diagnostico', descripcion: 'Revisar ventilador interno y externo', orden: 7 },
  { categoria: 'diagnostico', descripcion: 'Revisar resistencia de deshielo', orden: 8 },
  { categoria: 'diagnostico', descripcion: 'Revisar sello de puerta', orden: 9 },
  { categoria: 'diagnostico', descripcion: 'Revisar tarjeta electrónica', orden: 10 },
  { categoria: 'diagnostico', descripcion: 'Prueba de temperatura (mínimo 10 minutos)', orden: 11 },
  { categoria: 'reparacion', descripcion: 'Registrar repuestos utilizados', orden: 12 },
  { categoria: 'reparacion', descripcion: 'Registrar cantidad de gas cargado (si aplica)', orden: 13 },
  { categoria: 'reparacion', descripcion: 'Prueba de funcionamiento post-reparación', orden: 14 },
  { categoria: 'reparacion', descripcion: 'Registrar observaciones adicionales', orden: 15 },
  { categoria: 'cierre', descripcion: 'Tomar foto del equipo después del servicio', orden: 16 },
  { categoria: 'cierre', descripcion: 'Explicar al cliente el trabajo realizado', orden: 17 },
  { categoria: 'cierre', descripcion: 'Firma digital del cliente', orden: 18 },
  { categoria: 'cierre', descripcion: 'Registrar valor cobrado y método de pago', orden: 19 },
];

const checklistAire = [
  { categoria: 'llegada', descripcion: 'Tomar foto del equipo antes del servicio', orden: 1 },
  { categoria: 'llegada', descripcion: 'Confirmar modelo, serial y capacidad en BTU', orden: 2 },
  { categoria: 'diagnostico', descripcion: 'Verificar voltaje y amperaje', orden: 3 },
  { categoria: 'diagnostico', descripcion: 'Revisar nivel de gas refrigerante (R-410A o R-22)', orden: 4 },
  { categoria: 'diagnostico', descripcion: 'Revisar estado de los filtros', orden: 5 },
  { categoria: 'diagnostico', descripcion: 'Revisar compresor', orden: 6 },
  { categoria: 'diagnostico', descripcion: 'Revisar condensador', orden: 7 },
  { categoria: 'diagnostico', descripcion: 'Revisar evaporador', orden: 8 },
  { categoria: 'diagnostico', descripcion: 'Revisar control remoto', orden: 9 },
  { categoria: 'diagnostico', descripcion: 'Revisar tarjeta electrónica', orden: 10 },
  { categoria: 'diagnostico', descripcion: 'Medir temperatura de impulsión', orden: 11 },
  { categoria: 'diagnostico', descripcion: 'Verificar drenaje de condensados', orden: 12 },
  { categoria: 'reparacion', descripcion: 'Registrar repuestos utilizados', orden: 13 },
  { categoria: 'reparacion', descripcion: 'Registrar gas cargado (si aplica)', orden: 14 },
  { categoria: 'reparacion', descripcion: 'Limpieza de filtros (si aplica)', orden: 15 },
  { categoria: 'reparacion', descripcion: 'Prueba de funcionamiento post-reparación', orden: 16 },
  { categoria: 'reparacion', descripcion: 'Registrar observaciones adicionales', orden: 17 },
  { categoria: 'cierre', descripcion: 'Tomar foto del equipo después del servicio', orden: 18 },
  { categoria: 'cierre', descripcion: 'Explicar al cliente el trabajo realizado', orden: 19 },
  { categoria: 'cierre', descripcion: 'Firma digital del cliente', orden: 20 },
  { categoria: 'cierre', descripcion: 'Registrar valor cobrado y método de pago', orden: 21 },
];

const checklistOtro = [
  { categoria: 'llegada', descripcion: 'Tomar foto del equipo antes del servicio', orden: 1 },
  { categoria: 'llegada', descripcion: 'Confirmar modelo y serial del equipo', orden: 2 },
  { categoria: 'diagnostico', descripcion: 'Diagnóstico general del equipo', orden: 3 },
  { categoria: 'diagnostico', descripcion: 'Identificar falla principal', orden: 4 },
  { categoria: 'reparacion', descripcion: 'Registrar repuestos utilizados', orden: 5 },
  { categoria: 'reparacion', descripcion: 'Prueba de funcionamiento post-reparación', orden: 6 },
  { categoria: 'reparacion', descripcion: 'Registrar observaciones adicionales', orden: 7 },
  { categoria: 'cierre', descripcion: 'Tomar foto del equipo después del servicio', orden: 8 },
  { categoria: 'cierre', descripcion: 'Explicar al cliente el trabajo realizado', orden: 9 },
  { categoria: 'cierre', descripcion: 'Firma digital del cliente', orden: 10 },
  { categoria: 'cierre', descripcion: 'Registrar valor cobrado y método de pago', orden: 11 },
];

const getChecklistPorTipo = (tipoEquipo) => {
  switch (tipoEquipo) {
    case 'nevera': return checklistNevera;
    case 'aire_acondicionado': return checklistAire;
    default: return checklistOtro;
  }
};

module.exports = { getChecklistPorTipo, checklistNevera, checklistAire, checklistOtro };
