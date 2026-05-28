// Items comunes a todos los servicios
const llegadaComun = [
  { categoria: 'llegada', descripcion: 'Tomar foto del equipo antes del servicio' },
  { categoria: 'llegada', descripcion: 'Verificar datos del equipo' },
];

const cierreComun = [
  { categoria: 'cierre', descripcion: 'Tomar foto del equipo después del servicio' },
  { categoria: 'cierre', descripcion: 'Explicar al cliente el trabajo realizado' },
  { categoria: 'cierre', descripcion: 'Firma digital del cliente' },
  { categoria: 'cierre', descripcion: 'Registrar valor cobrado y método de pago' },
];

// ═══════════════════════════════════════
// AIRES
// ═══════════════════════════════════════

const mantAireSplit = [
  { categoria: 'diagnostico', descripcion: 'Apagar y desconectar el equipo' },
  { categoria: 'diagnostico', descripcion: 'Lavar filtros de aire (evaporador)' },
  { categoria: 'diagnostico', descripcion: 'Limpiar serpentín evaporador con químico' },
  { categoria: 'diagnostico', descripcion: 'Limpiar serpentín condensador con hidrolavadora' },
  { categoria: 'diagnostico', descripcion: 'Revisar y limpiar bandeja y manguera de drenaje' },
  { categoria: 'diagnostico', descripcion: 'Verificar presión de refrigerante (alta y baja)' },
  { categoria: 'diagnostico', descripcion: 'Medir amperaje del compresor y ventiladores' },
  { categoria: 'diagnostico', descripcion: 'Revisar estado del capacitor' },
  { categoria: 'diagnostico', descripcion: 'Verificar funcionamiento del control remoto' },
  { categoria: 'diagnostico', descripcion: 'Comprobar temperatura de salida del aire' },
  { categoria: 'diagnostico', descripcion: 'Revisar fijación y vibración de unidades' },
  { categoria: 'reparacion', descripcion: 'Registrar repuestos utilizados' },
  { categoria: 'reparacion', descripcion: 'Registrar gas cargado (si aplica)' },
  { categoria: 'reparacion', descripcion: 'Prueba final de funcionamiento en frío' },
];

const repAireSplit = [
  { categoria: 'diagnostico', descripcion: 'Diagnóstico inicial y entrevista al cliente' },
  { categoria: 'diagnostico', descripcion: 'Verificación de voltaje de alimentación' },
  { categoria: 'diagnostico', descripcion: 'Revisar tarjeta electrónica' },
  { categoria: 'diagnostico', descripcion: 'Revisar capacitores del compresor y ventilador' },
  { categoria: 'diagnostico', descripcion: 'Detección de fugas de refrigerante' },
  { categoria: 'diagnostico', descripcion: 'Verificar presiones del sistema (alta/baja)' },
  { categoria: 'diagnostico', descripcion: 'Comprobar estado del compresor (amperaje, ohmiaje)' },
  { categoria: 'diagnostico', descripcion: 'Revisar válvula de expansión o capilar' },
  { categoria: 'diagnostico', descripcion: 'Verificar sensores de temperatura' },
  { categoria: 'reparacion', descripcion: 'Reemplazo del componente dañado' },
  { categoria: 'reparacion', descripcion: 'Registrar repuestos utilizados' },
  { categoria: 'reparacion', descripcion: 'Vacío y recarga de gas (si aplica)' },
  { categoria: 'reparacion', descripcion: 'Pruebas de funcionamiento y entrega' },
];

const instAireSplit = [
  { categoria: 'diagnostico', descripcion: 'Inspección del sitio (ubicación interna y externa)' },
  { categoria: 'diagnostico', descripcion: 'Verificar distancia y desnivel entre unidades' },
  { categoria: 'reparacion', descripcion: 'Marcar y perforar pared para tubería' },
  { categoria: 'reparacion', descripcion: 'Instalar soporte de unidad exterior (anclado y nivelado)' },
  { categoria: 'reparacion', descripcion: 'Montar unidad interior en pared' },
  { categoria: 'reparacion', descripcion: 'Tendido y aislamiento de tubería de cobre' },
  { categoria: 'reparacion', descripcion: 'Conexión de tubería de drenaje con pendiente correcta' },
  { categoria: 'reparacion', descripcion: 'Conexión eléctrica (cable de poder y comunicación)' },
  { categoria: 'reparacion', descripcion: 'Abocardado y ajuste de tuercas a torque' },
  { categoria: 'reparacion', descripcion: 'Vacío del sistema con bomba (mantener 10 min)' },
  { categoria: 'reparacion', descripcion: 'Liberación de gas refrigerante del condensador' },
  { categoria: 'reparacion', descripcion: 'Verificación de fugas (jabón/detector)' },
  { categoria: 'reparacion', descripcion: 'Prueba de funcionamiento, delta T y temperatura final' },
  { categoria: 'reparacion', descripcion: 'Capacitación al cliente sobre uso y mantenimiento' },
];

const mantAirePortatil = [
  { categoria: 'diagnostico', descripcion: 'Desconectar el equipo' },
  { categoria: 'diagnostico', descripcion: 'Retirar carcasa exterior' },
  { categoria: 'diagnostico', descripcion: 'Lavar filtros de aire' },
  { categoria: 'diagnostico', descripcion: 'Limpiar serpentín evaporador y condensador' },
  { categoria: 'diagnostico', descripcion: 'Vaciar y limpiar tanque/bandeja de condensados' },
  { categoria: 'diagnostico', descripcion: 'Verificar manguera de extracción de aire caliente' },
  { categoria: 'diagnostico', descripcion: 'Revisar estado del ventilador y motor' },
  { categoria: 'diagnostico', descripcion: 'Medir amperaje del compresor' },
  { categoria: 'diagnostico', descripcion: 'Verificar funcionamiento del control y display' },
  { categoria: 'reparacion', descripcion: 'Registrar repuestos utilizados' },
  { categoria: 'reparacion', descripcion: 'Limpieza externa del gabinete' },
  { categoria: 'reparacion', descripcion: 'Prueba de funcionamiento' },
];

const repAirePortatil = [
  { categoria: 'diagnostico', descripcion: 'Diagnóstico de falla reportada' },
  { categoria: 'diagnostico', descripcion: 'Verificar voltaje y enchufe de alimentación' },
  { categoria: 'diagnostico', descripcion: 'Revisar tarjeta de control y display' },
  { categoria: 'diagnostico', descripcion: 'Comprobar estado del compresor (amperaje, arranque)' },
  { categoria: 'diagnostico', descripcion: 'Medir capacitor de arranque/marcha' },
  { categoria: 'diagnostico', descripcion: 'Revisar sensor de nivel de agua' },
  { categoria: 'diagnostico', descripcion: 'Verificar motor ventilador' },
  { categoria: 'diagnostico', descripcion: 'Detección de fugas y revisión de presiones' },
  { categoria: 'reparacion', descripcion: 'Reemplazo del componente defectuoso' },
  { categoria: 'reparacion', descripcion: 'Registrar repuestos utilizados' },
  { categoria: 'reparacion', descripcion: 'Recarga de gas (si aplica)' },
  { categoria: 'reparacion', descripcion: 'Pruebas y entrega' },
];

const mantAireVentana = [
  { categoria: 'diagnostico', descripcion: 'Desconectar de la red eléctrica' },
  { categoria: 'diagnostico', descripcion: 'Retirar el equipo del marco/ventana (si requiere)' },
  { categoria: 'diagnostico', descripcion: 'Lavar filtros de aire' },
  { categoria: 'diagnostico', descripcion: 'Limpiar serpentín evaporador y condensador' },
  { categoria: 'diagnostico', descripcion: 'Limpiar bandeja de condensados y verificar drenaje' },
  { categoria: 'diagnostico', descripcion: 'Revisar motor ventilador y aspas' },
  { categoria: 'diagnostico', descripcion: 'Verificar capacitor y selector de funciones' },
  { categoria: 'diagnostico', descripcion: 'Medir amperaje del compresor' },
  { categoria: 'diagnostico', descripcion: 'Revisar empaques y sellos del marco' },
  { categoria: 'reparacion', descripcion: 'Registrar repuestos utilizados' },
  { categoria: 'reparacion', descripcion: 'Reinstalar y verificar nivelación' },
  { categoria: 'reparacion', descripcion: 'Prueba de funcionamiento' },
];

const repAireVentana = [
  { categoria: 'diagnostico', descripcion: 'Diagnóstico y entrevista al cliente' },
  { categoria: 'diagnostico', descripcion: 'Verificar voltaje de alimentación' },
  { categoria: 'diagnostico', descripcion: 'Retirar equipo de la ventana (si necesario)' },
  { categoria: 'diagnostico', descripcion: 'Revisar selector mecánico o tarjeta de control' },
  { categoria: 'diagnostico', descripcion: 'Comprobar capacitor de arranque/marcha' },
  { categoria: 'diagnostico', descripcion: 'Medir continuidad del motor ventilador' },
  { categoria: 'diagnostico', descripcion: 'Verificar compresor (amperaje, ohmiaje)' },
  { categoria: 'diagnostico', descripcion: 'Detección de fugas y revisión de presiones' },
  { categoria: 'reparacion', descripcion: 'Reemplazo de componente defectuoso' },
  { categoria: 'reparacion', descripcion: 'Registrar repuestos utilizados' },
  { categoria: 'reparacion', descripcion: 'Recarga de gas (si aplica)' },
  { categoria: 'reparacion', descripcion: 'Reinstalación y prueba final' },
];

const instCompresor = [
  { categoria: 'diagnostico', descripcion: 'Desmontaje del compresor/unidad antigua' },
  { categoria: 'diagnostico', descripcion: 'Limpieza del sistema (filtros, tuberías)' },
  { categoria: 'reparacion', descripcion: 'Reemplazo del filtro secador (obligatorio)' },
  { categoria: 'reparacion', descripcion: 'Montaje y fijación del nuevo compresor/unidad' },
  { categoria: 'reparacion', descripcion: 'Soldadura de conexiones de tubería' },
  { categoria: 'reparacion', descripcion: 'Conexión eléctrica (línea, neutro, tierra, control)' },
  { categoria: 'reparacion', descripcion: 'Prueba de hermeticidad con nitrógeno' },
  { categoria: 'reparacion', descripcion: 'Vacío profundo del sistema (mínimo 30 min)' },
  { categoria: 'reparacion', descripcion: 'Carga de refrigerante según especificación' },
  { categoria: 'reparacion', descripcion: 'Verificación de presiones, amperaje y subenfriamiento' },
  { categoria: 'reparacion', descripcion: 'Registrar repuestos utilizados' },
  { categoria: 'reparacion', descripcion: 'Prueba de funcionamiento completa' },
];

// ═══════════════════════════════════════
// NEVERAS
// ═══════════════════════════════════════

const repNeveraNoFrost = [
  { categoria: 'diagnostico', descripcion: 'Diagnóstico y entrevista al cliente' },
  { categoria: 'diagnostico', descripcion: 'Verificar voltaje y toma eléctrica' },
  { categoria: 'diagnostico', descripcion: 'Revisar tarjeta electrónica de control' },
  { categoria: 'diagnostico', descripcion: 'Comprobar termostato y sensores (evaporador, ambiente, defrost)' },
  { categoria: 'diagnostico', descripcion: 'Verificar resistencia de deshielo y bimetal' },
  { categoria: 'diagnostico', descripcion: 'Revisar motor ventilador del evaporador y condensador' },
  { categoria: 'diagnostico', descripcion: 'Limpieza del condensador trasero' },
  { categoria: 'diagnostico', descripcion: 'Verificar estado del compresor (amperaje, ohmiaje, relay)' },
  { categoria: 'diagnostico', descripcion: 'Detección de fugas en sistema sellado' },
  { categoria: 'diagnostico', descripcion: 'Verificar obstrucción en capilar o filtro secador' },
  { categoria: 'reparacion', descripcion: 'Recuperación, vacío y recarga de gas (si aplica)' },
  { categoria: 'reparacion', descripcion: 'Registrar repuestos utilizados' },
  { categoria: 'reparacion', descripcion: 'Verificar empaques de puertas' },
  { categoria: 'reparacion', descripcion: 'Prueba de temperatura en refrigerador y congelador' },
];

const repNeveraEscarcha = [
  { categoria: 'diagnostico', descripcion: 'Diagnóstico inicial y descongelamiento (si requiere)' },
  { categoria: 'diagnostico', descripcion: 'Verificar voltaje y enchufe' },
  { categoria: 'diagnostico', descripcion: 'Revisar termostato mecánico' },
  { categoria: 'diagnostico', descripcion: 'Comprobar estado del compresor (amperaje, arranque, térmico, relay)' },
  { categoria: 'diagnostico', descripcion: 'Verificar motor del evaporador (si aplica)' },
  { categoria: 'diagnostico', descripcion: 'Limpieza del condensador' },
  { categoria: 'diagnostico', descripcion: 'Detección de fugas (revisar serpentín y soldaduras)' },
  { categoria: 'diagnostico', descripcion: 'Revisar obstrucción en capilar o filtro' },
  { categoria: 'diagnostico', descripcion: 'Verificar empaques de puerta' },
  { categoria: 'reparacion', descripcion: 'Recuperación, vacío y recarga de gas (si aplica)' },
  { categoria: 'reparacion', descripcion: 'Reemplazo de filtro secador (si se abrió el sistema)' },
  { categoria: 'reparacion', descripcion: 'Registrar repuestos utilizados' },
  { categoria: 'reparacion', descripcion: 'Prueba de temperatura' },
];

const repNeveraInverter = [
  { categoria: 'diagnostico', descripcion: 'Diagnóstico con lectura de códigos de error' },
  { categoria: 'diagnostico', descripcion: 'Verificar voltaje de entrada y filtros de línea' },
  { categoria: 'diagnostico', descripcion: 'Revisar tarjeta principal (PCB) y tarjeta inverter' },
  { categoria: 'diagnostico', descripcion: 'Comprobar sensores (NTC) evaporador, refrigerador, congelador' },
  { categoria: 'diagnostico', descripcion: 'Verificar comunicación entre tarjetas' },
  { categoria: 'diagnostico', descripcion: 'Medir resistencia del compresor inverter (bobinados)' },
  { categoria: 'diagnostico', descripcion: 'Comprobar compresor a distintas frecuencias' },
  { categoria: 'diagnostico', descripcion: 'Revisar ventiladores BLDC' },
  { categoria: 'diagnostico', descripcion: 'Verificar válvula step (si aplica)' },
  { categoria: 'diagnostico', descripcion: 'Detección de fugas y revisión de sistema sellado' },
  { categoria: 'reparacion', descripcion: 'Recuperación, vacío profundo y recarga según placa' },
  { categoria: 'reparacion', descripcion: 'Registrar repuestos utilizados' },
  { categoria: 'reparacion', descripcion: 'Reset y actualización de parámetros' },
  { categoria: 'reparacion', descripcion: 'Prueba de temperatura y modos especiales' },
];

const mantNevera = [
  { categoria: 'diagnostico', descripcion: 'Desconectar nevera y descongelar (si aplica)' },
  { categoria: 'diagnostico', descripcion: 'Limpieza del serpentín condensador' },
  { categoria: 'diagnostico', descripcion: 'Limpieza de bandeja y manguera de drenaje' },
  { categoria: 'diagnostico', descripcion: 'Limpieza del ventilador del condensador' },
  { categoria: 'diagnostico', descripcion: 'Revisión y limpieza de empaques de puertas' },
  { categoria: 'diagnostico', descripcion: 'Medir voltaje y amperaje del compresor' },
  { categoria: 'diagnostico', descripcion: 'Verificar temperaturas en refrigerador y congelador' },
  { categoria: 'diagnostico', descripcion: 'Revisar funcionamiento de luz interior y display' },
  { categoria: 'reparacion', descripcion: 'Registrar repuestos utilizados' },
  { categoria: 'reparacion', descripcion: 'Limpieza interior y exterior' },
  { categoria: 'reparacion', descripcion: 'Recomendaciones al cliente' },
];

const instCircuitoNevera = [
  { categoria: 'diagnostico', descripcion: 'Verificar carga eléctrica del equipo (amperaje nominal)' },
  { categoria: 'diagnostico', descripcion: 'Identificar tablero principal y espacio para breaker' },
  { categoria: 'reparacion', descripcion: 'Tendido de cable calibre apropiado (mín 3x12 AWG)' },
  { categoria: 'reparacion', descripcion: 'Verificar continuidad y aislamiento del circuito' },
  { categoria: 'reparacion', descripcion: 'Medir voltaje en toma (fase-neutro y fase-tierra)' },
  { categoria: 'reparacion', descripcion: 'Comprobar resistencia de tierra' },
  { categoria: 'reparacion', descripcion: 'Conexión y prueba de la nevera' },
  { categoria: 'reparacion', descripcion: 'Marcado del breaker en el tablero' },
  { categoria: 'reparacion', descripcion: 'Registrar repuestos utilizados' },
  { categoria: 'reparacion', descripcion: 'Reporte y certificación del trabajo' },
];

// ═══════════════════════════════════════
// OTROS
// ═══════════════════════════════════════

const repCongelador = [
  { categoria: 'diagnostico', descripcion: 'Diagnóstico y entrevista al cliente' },
  { categoria: 'diagnostico', descripcion: 'Verificar voltaje' },
  { categoria: 'diagnostico', descripcion: 'Revisar contactor, relé de arranque y térmico' },
  { categoria: 'diagnostico', descripcion: 'Comprobar termostato y sensores' },
  { categoria: 'diagnostico', descripcion: 'Verificar resistencia de deshielo y temporizador' },
  { categoria: 'diagnostico', descripcion: 'Revisar motor ventilador evaporador y condensador' },
  { categoria: 'diagnostico', descripcion: 'Medir amperaje y ohmiaje del compresor' },
  { categoria: 'diagnostico', descripcion: 'Limpieza del condensador' },
  { categoria: 'diagnostico', descripcion: 'Detección de fugas en sistema sellado' },
  { categoria: 'diagnostico', descripcion: 'Verificar válvula solenoide y válvula de expansión' },
  { categoria: 'diagnostico', descripcion: 'Comprobar obstrucción en filtro secador o capilar' },
  { categoria: 'reparacion', descripcion: 'Recuperación, vacío y recarga de refrigerante' },
  { categoria: 'reparacion', descripcion: 'Registrar repuestos utilizados' },
  { categoria: 'reparacion', descripcion: 'Verificar empaques y resistencias perimetrales' },
  { categoria: 'reparacion', descripcion: 'Prueba de temperatura y ciclo de deshielo' },
];

const servExhibidora = [
  { categoria: 'diagnostico', descripcion: 'Diagnóstico inicial y revisión de carga del equipo' },
  { categoria: 'diagnostico', descripcion: 'Verificar voltaje y conexión eléctrica' },
  { categoria: 'diagnostico', descripcion: 'Limpieza del condensador' },
  { categoria: 'diagnostico', descripcion: 'Revisar ventiladores (evaporador y condensador)' },
  { categoria: 'diagnostico', descripcion: 'Verificar termostato y control de temperatura' },
  { categoria: 'diagnostico', descripcion: 'Comprobar sistema de iluminación' },
  { categoria: 'diagnostico', descripcion: 'Revisar resistencia de deshielo y drenaje' },
  { categoria: 'diagnostico', descripcion: 'Verificar empaques y cierre de puertas' },
  { categoria: 'diagnostico', descripcion: 'Medir amperaje del compresor' },
  { categoria: 'diagnostico', descripcion: 'Detección de fugas y revisión de presiones' },
  { categoria: 'reparacion', descripcion: 'Recuperación, vacío y recarga (si aplica)' },
  { categoria: 'reparacion', descripcion: 'Registrar repuestos utilizados' },
  { categoria: 'reparacion', descripcion: 'Verificar temperatura de exhibición según producto' },
  { categoria: 'reparacion', descripcion: 'Limpieza general interior y exterior' },
];

const servCuartoFrio = [
  { categoria: 'diagnostico', descripcion: 'Inspección general de paneles y aislamiento' },
  { categoria: 'diagnostico', descripcion: 'Verificar hermetismo de puertas (empaques, bisagras)' },
  { categoria: 'diagnostico', descripcion: 'Revisar resistencias perimetrales anti-condensación' },
  { categoria: 'diagnostico', descripcion: 'Inspeccionar unidad condensadora (motor, ventilador, contactor)' },
  { categoria: 'diagnostico', descripcion: 'Limpieza del condensador' },
  { categoria: 'diagnostico', descripcion: 'Revisar evaporadores y ventiladores forzados' },
  { categoria: 'diagnostico', descripcion: 'Verificar resistencias y ciclo de deshielo' },
  { categoria: 'diagnostico', descripcion: 'Comprobar válvula solenoide y válvula de expansión' },
  { categoria: 'diagnostico', descripcion: 'Medir presiones de alta y baja' },
  { categoria: 'diagnostico', descripcion: 'Detección de fugas en líneas de refrigerante' },
  { categoria: 'diagnostico', descripcion: 'Verificar tablero eléctrico y controlador' },
  { categoria: 'diagnostico', descripcion: 'Comprobar alarmas y sensores de temperatura' },
  { categoria: 'diagnostico', descripcion: 'Revisar drenajes y sifón sanitario' },
  { categoria: 'diagnostico', descripcion: 'Verificar iluminación interior y seguridad de puerta' },
  { categoria: 'reparacion', descripcion: 'Recuperación, vacío y recarga de refrigerante (si aplica)' },
  { categoria: 'reparacion', descripcion: 'Registrar repuestos utilizados' },
  { categoria: 'reparacion', descripcion: 'Prueba completa y registro de temperaturas' },
];

const visitaDiagnostico = [
  { categoria: 'diagnostico', descripcion: 'Entrevista al cliente: síntomas, tiempo de falla' },
  { categoria: 'diagnostico', descripcion: 'Inspección visual del equipo (golpes, manchas, ruidos)' },
  { categoria: 'diagnostico', descripcion: 'Verificar voltaje en toma eléctrica' },
  { categoria: 'diagnostico', descripcion: 'Encender equipo y observar comportamiento' },
  { categoria: 'diagnostico', descripcion: 'Medir temperaturas de entrada y salida' },
  { categoria: 'diagnostico', descripcion: 'Medir amperaje y consumo' },
  { categoria: 'diagnostico', descripcion: 'Revisar códigos de error (si display lo muestra)' },
  { categoria: 'diagnostico', descripcion: 'Inspeccionar componentes principales sin desmontar' },
  { categoria: 'diagnostico', descripcion: 'Identificar causa probable de la falla' },
  { categoria: 'reparacion', descripcion: 'Cotizar repuestos y mano de obra al cliente' },
  { categoria: 'reparacion', descripcion: 'Entregar informe y autorización para proceder' },
];

// ═══════════════════════════════════════
// Mapa de checklists por clave "tipoEquipo:tipoServicio"
// ═══════════════════════════════════════
const checklists = {
  // Aires split
  'aire_acondicionado:mantenimiento': mantAireSplit,
  'aire_acondicionado:reparacion': repAireSplit,
  'aire_acondicionado:instalacion': instAireSplit,
  // Aires portátil
  'aire_portatil:mantenimiento': mantAirePortatil,
  'aire_portatil:reparacion': repAirePortatil,
  // Aires ventana
  'aire_ventana:mantenimiento': mantAireVentana,
  'aire_ventana:reparacion': repAireVentana,
  // Compresor / Unidad
  'compresor:instalacion': instCompresor,
  // Neveras
  'nevera_no_frost:reparacion': repNeveraNoFrost,
  'nevera_escarcha:reparacion': repNeveraEscarcha,
  'nevera_inverter:reparacion': repNeveraInverter,
  'nevera:mantenimiento': mantNevera,
  'nevera:instalacion': instCircuitoNevera,
  // Otros
  'congelador:reparacion': repCongelador,
  'exhibidora:reparacion': servExhibidora,
  'cuarto_frio:reparacion': servCuartoFrio,
  // Diagnóstico genérico
  'diagnostico': visitaDiagnostico,
};

// Fallbacks por solo tipo de equipo (compatibilidad)
const fallbackPorEquipo = {
  aire_acondicionado: repAireSplit,
  nevera: repNeveraNoFrost,
};

const getChecklistPorTipo = (tipoEquipo, tipoServicio) => {
  // 1. Diagnóstico siempre es el mismo
  if (tipoServicio === 'diagnostico') {
    return numerarChecklist([...llegadaComun, ...visitaDiagnostico, ...cierreComun]);
  }

  // 2. Buscar match exacto equipo:servicio
  const clave = `${tipoEquipo}:${tipoServicio}`;
  if (checklists[clave]) {
    return numerarChecklist([...llegadaComun, ...checklists[clave], ...cierreComun]);
  }

  // 3. Si es nevera genérica, buscar según subtipo
  if (tipoEquipo === 'nevera' && tipoServicio === 'reparacion') {
    return numerarChecklist([...llegadaComun, ...repNeveraNoFrost, ...cierreComun]);
  }

  // 4. Fallback por tipo de equipo
  if (fallbackPorEquipo[tipoEquipo]) {
    return numerarChecklist([...llegadaComun, ...fallbackPorEquipo[tipoEquipo], ...cierreComun]);
  }

  // 5. Fallback genérico (diagnóstico visita)
  return numerarChecklist([...llegadaComun, ...visitaDiagnostico, ...cierreComun]);
};

const numerarChecklist = (items) =>
  items.map((item, i) => ({ ...item, orden: i + 1 }));

module.exports = { getChecklistPorTipo };
