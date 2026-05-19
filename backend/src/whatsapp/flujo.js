const prisma = require('../config/db');
const { getIO } = require('../config/socket');
const { getChecklistPorTipo } = require('../services/checklistService');
const { obtenerDisponibilidad, asignarTecnicoParaSlot } = require('../services/disponibilidadService');
const { generarRespuestaCompleta, iaDisponible } = require('../services/iaService');
const { escribiendoTimestamps } = require('./estado');
const { formatCurrency } = require('../utils/helpers');

const TIMEOUT_MS = 30 * 60 * 1000;

// ═══════════════════════════════════════════════════════════════
// PATRÓN N8N: Timer por teléfono que se reinicia con cada mensaje
// ═══════════════════════════════════════════════════════════════
const timers = new Map();
const buffers = new Map();

let configTimers = { debounce: 15000, maxEspera: 45000, typingEspera: 8000, delayRespuesta: 2000 };

const cargarTimers = async () => {
  try {
    const config = await prisma.configuracion.findFirst();
    if (config) {
      configTimers = {
        debounce: config.bot_debounce_ms || 15000,
        maxEspera: config.bot_max_espera_ms || 45000,
        typingEspera: config.bot_typing_espera_ms || 8000,
        delayRespuesta: config.bot_delay_respuesta_ms || 2000,
      };
    }
  } catch (_) {}
};

const upsertConversacion = async (telefono, data) => {
  const result = await prisma.conversacionWhatsApp.upsert({
    where: { telefono },
    update: { ...data, ultimo_mensaje_at: new Date(), updatedAt: new Date() },
    create: { telefono, ...data, ultimo_mensaje_at: new Date() },
  });
  try { getIO().to('admin').emit('whatsapp_conversacion_update', { telefono }); } catch (_) {}
  return result;
};

// ═══════════════════════════════════════════════════════════════
// ENTRADA PRINCIPAL: cada mensaje llega aquí
// ═══════════════════════════════════════════════════════════════
const manejarMensaje = async (sock, telefono, remoteJid, contenido, sesiones) => {
  const conv = await prisma.conversacionWhatsApp.findUnique({ where: { telefono } });
  if (conv && !conv.bot_activo) return;

  let sesion = sesiones.get(telefono);
  const ahora = Date.now();

  if (sesion && ahora - sesion.ultimo_mensaje_at > TIMEOUT_MS) {
    sesiones.delete(telefono);
    sesion = null;
  }

  if (!sesion) {
    sesion = { paso: 'conversar', datos: {}, historial: [], ultimo_mensaje_at: ahora };
    if (conv?.nombre) sesion.datos.nombre = conv.nombre;
    sesiones.set(telefono, sesion);
  }

  sesion.ultimo_mensaje_at = ahora;
  sesion.historial.push({ rol: 'cliente', texto: contenido });

  // Acumular en buffer
  if (!buffers.has(telefono)) {
    buffers.set(telefono, { mensajes: [], remoteJid, sock, sesiones, inicio: ahora });
    console.log(`[Debounce] 🟢 Nuevo buffer para ${telefono}`);
  }
  const buffer = buffers.get(telefono);
  buffer.mensajes.push(contenido);
  buffer.remoteJid = remoteJid;
  const segDesdeInicio = ((ahora - buffer.inicio) / 1000).toFixed(1);
  console.log(`[Debounce] 📩 Mensaje #${buffer.mensajes.length} de ${telefono} [+${segDesdeInicio}s]: "${contenido}"`);

  // Cargar config si es el primer mensaje del ciclo
  if (buffer.mensajes.length === 1) {
    await cargarTimers();
  }

  // ═══════════════════════════════════════════════════════════════
  // CANCELAR timer anterior y poner uno nuevo (patrón n8n)
  // ═══════════════════════════════════════════════════════════════
  if (timers.has(telefono)) {
    clearTimeout(timers.get(telefono));
    console.log(`[Debounce] 🔄 Timer reiniciado para ${telefono} (${configTimers.debounce / 1000}s)`);
  }

  // Calcular tiempo restante (no exceder maxEspera desde el primer mensaje)
  const tiempoTranscurrido = ahora - buffer.inicio;
  const tiempoRestante = Math.max(0, configTimers.maxEspera - tiempoTranscurrido);
  const espera = Math.min(configTimers.debounce, tiempoRestante);

  console.log(`[Debounce] ⏱️ Espera: ${espera / 1000}s | Transcurrido: ${tiempoTranscurrido / 1000}s | Max: ${configTimers.maxEspera / 1000}s`);

  // Si ya se agotó el máximo, procesar inmediatamente
  if (espera <= 0) {
    console.log(`[Debounce] ⚡ Max alcanzado, procesando inmediatamente`);
    timers.delete(telefono);
    procesarBuffer(telefono, sesiones);
    return;
  }

  const timer = setTimeout(() => {
    // Antes de procesar, verificar si el cliente sigue escribiendo
    const ultimoEscribiendo = escribiendoTimestamps.get(telefono);
    if (ultimoEscribiendo && Date.now() - ultimoEscribiendo <= configTimers.typingEspera) {
      console.log(`[Debounce] ✍️ Cliente sigue escribiendo, esperando ${configTimers.typingEspera / 1000}s más`);
      const recheck = setTimeout(() => {
        console.log(`[Debounce] ✅ Timer expiró para ${telefono} — procesando ${buffer.mensajes.length} mensajes`);
        timers.delete(telefono);
        procesarBuffer(telefono, sesiones);
      }, configTimers.typingEspera);
      timers.set(telefono, recheck);
      return;
    }

    console.log(`[Debounce] ✅ Timer expiró para ${telefono} — procesando ${buffer.mensajes.length} mensajes`);
    timers.delete(telefono);
    procesarBuffer(telefono, sesiones);
  }, espera);

  timers.set(telefono, timer);
};

// ═══════════════════════════════════════════════════════════════
// PROCESAR: se ejecuta cuando el timer expira (cliente dejó de escribir)
// ═══════════════════════════════════════════════════════════════
const procesarBuffer = async (telefono, sesiones) => {
  const buffer = buffers.get(telefono);
  if (!buffer || buffer.mensajes.length === 0) return;

  const { mensajes, remoteJid, sock } = buffer;
  const contenidoCompleto = mensajes.join('\n');
  const ultimoMensaje = mensajes[mensajes.length - 1];

  const tiempoTotal = ((Date.now() - buffer.inicio) / 1000).toFixed(1);
  console.log(`[Debounce] 🤖 Procesando ${mensajes.length} mensajes de ${telefono} (esperó ${tiempoTotal}s total)`);
  console.log(`[Debounce] 📋 Contenido completo: "${contenidoCompleto}"`);

  const inicioIA = Date.now();

  // Limpiar buffer
  buffers.delete(telefono);

  const sesion = sesiones.get(telefono);
  if (!sesion) return;

  // Mostrar "escribiendo..." mientras procesa
  try { await sock.sendPresenceUpdate('composing', remoteJid); } catch (_) {}

  const enviar = async (msg) => {
    if (configTimers.delayRespuesta > 0) {
      try { await sock.sendPresenceUpdate('composing', remoteJid); } catch (_) {}
      await new Promise(resolve => setTimeout(resolve, configTimers.delayRespuesta));
    }
    try { await sock.sendPresenceUpdate('paused', remoteJid); } catch (_) {}
    await sock.sendMessage(remoteJid, { text: msg });
    await prisma.mensajeWhatsApp.create({
      data: { telefono, direccion: 'saliente', contenido: msg, tipo: 'texto', estado: 'procesado', sesion_id: telefono },
    });
    try { getIO().to('admin').emit('whatsapp_conversacion_update', { telefono }); } catch (_) {}
  };

  const config = await prisma.configuracion.findFirst();
  const negocio = config?.nombre_negocio || process.env.NOMBRE_NEGOCIO || 'RefriElectri Pro';

  // ═══════════════════════════════════════════════
  // OBTENER CONTEXTO DEL CLIENTE
  // ═══════════════════════════════════════════════
  const conv = await prisma.conversacionWhatsApp.findUnique({ where: { telefono } });
  const cliente = await prisma.cliente.findUnique({
    where: { telefono },
    include: {
      equipos: { orderBy: { updatedAt: 'desc' }, take: 5 },
      servicios: {
        where: { estado: { notIn: ['completado', 'cancelado'] } },
        include: { tecnico: { select: { nombre: true } }, equipo: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  let contextoCliente = '';
  if (cliente) {
    contextoCliente = `Cliente registrado en BD:
- Nombre: ${cliente.nombre}
- Teléfono: ${cliente.telefono}
- Dirección: ${cliente.direccion_principal || 'No registrada'}
- Equipos registrados: ${cliente.equipos.map(e => `${e.tipo}${e.marca ? ' ' + e.marca : ''}${e.modelo ? ' ' + e.modelo : ''}`).join(', ') || 'Ninguno'}`;

    if (cliente.servicios[0]) {
      const sa = cliente.servicios[0];
      contextoCliente += `\n- Servicio activo: ${sa.estado} (${sa.equipo?.tipo || ''})${sa.tecnico ? ' - Técnico: ' + sa.tecnico.nombre : ''}`;
    }
  } else if (conv?.nombre) {
    contextoCliente = `Cliente conocido (nombre: ${conv.nombre}) pero no registrado en BD como cliente.`;
  }

  // ═══════════════════════════════════════════════
  // PASO: ELEGIR FECHA
  // ═══════════════════════════════════════════════
  if (sesion.paso === 'elegir_fecha') {
    const slots = sesion.datos.slots || [];
    const opcionesTexto = slots.map((s, i) => `${i + 1}. ${s.diaLabel} de ${s.label}`).join('\n');

    // La IA interpreta la respuesta del cliente
    const respIA = await generarRespuestaCompleta({
      negocio,
      nombre: sesion.datos.nombre || cliente?.nombre || null,
      historial: sesion.historial,
      datosRecolectados: sesion.datos,
      mensaje: `El cliente debe elegir un horario de estas opciones:\n${opcionesTexto}\n\nEl cliente respondió: "${contenidoCompleto}"\n\nResponde SOLO con el número de la opción que eligió (1, 2, 3 o 4). Si no se entiende qué eligió, responde "0".`,
      contextoCliente: '',
    });

    const opcion = parseInt((respIA || '').match(/(\d+)/)?.[1]) || 0;

    if (!opcion || opcion < 1 || opcion > slots.length) {
      await enviar(`Disculpa, no entendí cuál horario prefieres 😅 ¿Me dices el número? Del 1 al ${slots.length}`);
      return;
    }

    const slotElegido = slots[opcion - 1];
    const tecnico = await asignarTecnicoParaSlot(sesion.datos.tipo_equipo || 'otro', slotElegido.fechaKey, slotElegido.hora_inicio);
    const tecnicoId = tecnico?.id || slotElegido.tecnicoId;
    const tecnicoNombre = tecnico?.nombre || slotElegido.tecnicoNombre;

    const valorDiag = config?.valor_diagnostico || 40000;
    const tipoLabel = { nevera: 'Nevera', aire_acondicionado: 'Aire acondicionado', otro: 'Otro equipo' };

    let clienteId = sesion.datos.clienteId;
    if (!clienteId) {
      const nuevoCliente = await prisma.cliente.create({
        data: { nombre: sesion.datos.nombre, telefono, direccion_principal: sesion.datos.direccion },
      });
      clienteId = nuevoCliente.id;
    }

    let equipoId = sesion.datos.equipoExistenteId || null;
    if (!equipoId) {
      const equipo = await prisma.equipo.create({
        data: {
          clienteId, tipo: sesion.datos.tipo_equipo || 'otro',
          marca: sesion.datos.marca || null, modelo: sesion.datos.modelo || null,
        },
      });
      equipoId = equipo.id;
    }

    const checklistItems = getChecklistPorTipo(sesion.datos.tipo_equipo || 'otro');

    const servicio = await prisma.servicio.create({
      data: {
        clienteId, equipoId, tecnicoId,
        estado: 'asignado',
        descripcion_falla: sesion.datos.falla,
        fecha_programada: new Date(slotElegido.fecha),
        hora_inicio: slotElegido.hora_inicio, hora_fin: slotElegido.hora_fin,
        direccion_servicio: sesion.datos.direccion,
        valor_estimado: valorDiag,
        origen: 'whatsapp',
        checklist: { create: checklistItems },
        eventos: {
          create: [
            { tipo: 'creado', descripcion: 'Servicio creado desde WhatsApp (asistente IA)' },
            { tipo: 'asignado', descripcion: `Asignado automáticamente a ${tecnicoNombre}` },
          ],
        },
      },
      include: { cliente: true, equipo: true, tecnico: { select: { id: true, nombre: true } } },
    });

    await enviar(
      `¡Listo ${sesion.datos.nombre}! Tu servicio quedó agendado:\n📅 ${slotElegido.diaLabel} de ${slotElegido.label}\n📍 ${sesion.datos.direccion}\n🔧 ${tipoLabel[sesion.datos.tipo_equipo] || 'Equipo'}${sesion.datos.marca ? ' ' + sesion.datos.marca : ''}\n👨‍🔧 Técnico: ${tecnicoNombre}\n💰 Diagnóstico: ${formatCurrency(valorDiag)}\n\nTe avisaremos antes de la llegada del técnico. ¡Gracias por confiar en ${negocio}!`
    );

    try {
      const tecnicoUser = await prisma.usuario.findUnique({ where: { id: tecnicoId }, select: { telefono: true } });
      if (tecnicoUser?.telefono) {
        const tecJid = `${tecnicoUser.telefono}@s.whatsapp.net`;
        await sock.sendMessage(tecJid, {
          text: `📋 *Nuevo servicio asignado*\n\n👤 Cliente: ${sesion.datos.nombre}\n📍 Dirección: ${sesion.datos.direccion}\n📅 Fecha: ${slotElegido.diaLabel}\n🕐 Horario: ${slotElegido.label}\n🔧 Equipo: ${tipoLabel[sesion.datos.tipo_equipo] || 'Equipo'}${sesion.datos.marca ? ' ' + sesion.datos.marca : ''}\n📝 Problema: ${sesion.datos.falla}\n💰 Diagnóstico: ${formatCurrency(valorDiag)}`,
        });
      }
    } catch (err) {
      console.error('[WhatsApp] Error notificando técnico:', err.message);
    }

    await upsertConversacion(telefono, {
      clienteId, nombre: sesion.datos.nombre, estado: 'agendado',
      servicioId: servicio.id,
      ultimo_mensaje: `Servicio agendado - ${tipoLabel[sesion.datos.tipo_equipo] || 'Equipo'} - ${tecnicoNombre}`,
    });

    try {
      getIO().to('admin').emit('nuevo_servicio', servicio);
      getIO().to('admin').emit('whatsapp_conversacion_update', { telefono });
    } catch (_) {}

    await prisma.mensajeWhatsApp.updateMany({
      where: { telefono, estado: 'pendiente' },
      data: { estado: 'procesado' },
    });

    sesiones.delete(telefono);
    return;
  }

  // ═══════════════════════════════════════════════
  // PASO: CONVERSAR — La IA maneja todo
  // ═══════════════════════════════════════════════
  if (sesion.paso === 'conversar') {
    if (!iaDisponible()) {
      await upsertConversacion(telefono, { estado: 'en_conversacion', ultimo_mensaje: contenidoCompleto });
      await enviar(`¡Hola! Soy Valentina de ${negocio} 😊 ¿En qué te puedo ayudar?\n1. Solicitar un servicio técnico\n2. Ver el estado de mi servicio\n3. Hablar con un asesor`);
      return;
    }

    console.log(`[IA] 🧠 Enviando a DeepSeek (${contenidoCompleto.length} chars)...`);
    const resp = await generarRespuestaCompleta({
      negocio,
      nombre: sesion.datos.nombre || cliente?.nombre || null,
      historial: sesion.historial,
      datosRecolectados: sesion.datos,
      mensaje: contenidoCompleto,
      contextoCliente,
    });
    const tiempoIA = ((Date.now() - inicioIA) / 1000).toFixed(1);
    console.log(`[IA] ✅ DeepSeek respondió en ${tiempoIA}s`);

    if (!resp) {
      console.log(`[IA] ⚠️ Respuesta vacía, usando fallback`);
      await upsertConversacion(telefono, { estado: 'en_conversacion', ultimo_mensaje: contenidoCompleto });
      await enviar(`¡Hola! Soy Valentina de ${negocio} 😊 ¿En qué te puedo ayudar?\n1. Solicitar un servicio técnico\n2. Ver el estado de mi servicio\n3. Hablar con un asesor`);
      return;
    }

    sesion.historial.push({ rol: 'valentina', texto: resp });

    const nombreMatch = resp.match(/\[NOMBRE:([^\]]+)\]/);
    if (nombreMatch) {
      sesion.datos.nombre = nombreMatch[1].trim();
      await upsertConversacion(telefono, { nombre: sesion.datos.nombre });
    }

    const equipoMatch = resp.match(/\[EQUIPO:([^\]]+)\]/);
    if (equipoMatch) sesion.datos.tipo_equipo = equipoMatch[1].trim();

    const fallaMatch = resp.match(/\[FALLA:([^\]]+)\]/);
    if (fallaMatch) sesion.datos.falla = fallaMatch[1].trim();

    const direccionMatch = resp.match(/\[DIRECCION:([^\]]+)\]/);
    if (direccionMatch) sesion.datos.direccion = direccionMatch[1].trim();

    const referenciaMatch = resp.match(/\[REFERENCIA:([^\]]+)\]/);
    if (referenciaMatch) sesion.datos.referencia = referenciaMatch[1].trim();

    if (resp.includes('[AGENDAR]')) {
      return await procesarAgendamiento(sock, telefono, remoteJid, sesion, enviar, config, negocio);
    }

    if (resp.includes('[ESCALAR]')) {
      await upsertConversacion(telefono, { estado: 'escalado', ultimo_mensaje: contenidoCompleto });
      try { getIO().to('admin').emit('whatsapp_escalado', { telefono, nombre: sesion.datos.nombre }); } catch (_) {}
      sesiones.delete(telefono);
      return;
    }

    const mensajeLimpio = resp
      .replace(/\[NOMBRE:[^\]]+\]/g, '')
      .replace(/\[EQUIPO:[^\]]+\]/g, '')
      .replace(/\[FALLA:[^\]]+\]/g, '')
      .replace(/\[DIRECCION:[^\]]+\]/g, '')
      .replace(/\[REFERENCIA:[^\]]+\]/g, '')
      .replace(/\[AGENDAR\]/g, '')
      .replace(/\[ESCALAR\]/g, '')
      .trim();

    await upsertConversacion(telefono, { estado: 'en_conversacion', ultimo_mensaje: contenidoCompleto });
    console.log(`[Bot] 📤 Enviando respuesta a ${telefono} (delay ${configTimers.delayRespuesta / 1000}s)...`);
    await enviar(mensajeLimpio);
    const tiempoTotalFinal = ((Date.now() - inicioIA) / 1000).toFixed(1);
    console.log(`[Bot] ✅ Respuesta enviada a ${telefono} — tiempo total desde debounce: ${tiempoTotalFinal}s`);
    return;
  }
};

async function procesarAgendamiento(sock, telefono, remoteJid, sesion, enviar, config, negocio) {
  const tipoLabel = { nevera: 'Nevera', aire_acondicionado: 'Aire acondicionado', otro: 'Otro equipo' };
  const tipo = sesion.datos.tipo_equipo || 'otro';

  const slots = await obtenerDisponibilidad(tipo, 7, 4);

  if (slots.length === 0) {
    await enviar('Disculpa, revisé la agenda y no tenemos disponibilidad en los próximos días 😔 Voy a pasar tu caso a un asesor para que te coordine una fecha.');
    await upsertConversacion(telefono, { estado: 'escalado', ultimo_mensaje: 'Sin disponibilidad técnica' });
    try { getIO().to('admin').emit('whatsapp_escalado', { telefono, nombre: sesion.datos.nombre, razon: 'Sin disponibilidad' }); } catch (_) {}
    sesiones.delete(telefono);
    return;
  }

  sesion.datos.slots = slots.map(s => ({
    fecha: s.fecha, fechaKey: s.fechaKey, hora_inicio: s.hora_inicio, hora_fin: s.hora_fin,
    diaLabel: s.diaLabel, label: s.label, tecnicoId: s.tecnico.id, tecnicoNombre: s.tecnico.nombre,
  }));

  const resumen = `Perfecto, te confirmo los datos:\n🔧 Equipo: ${tipoLabel[tipo] || tipo}${sesion.datos.marca ? ' ' + sesion.datos.marca : ''}\n📝 Problema: ${sesion.datos.falla}\n📍 Dirección: ${sesion.datos.direccion}${sesion.datos.referencia ? '\n📍 Referencia: ' + sesion.datos.referencia : ''}`;

  const opciones = slots.map((s, i) => `${i + 1}. ${s.diaLabel} de ${s.label}`);

  sesion.paso = 'elegir_fecha';
  await enviar(`${resumen}\n\nConsulté la agenda y tenemos técnicos disponibles:\n${opciones.join('\n')}\n\n¿Cuál horario te funciona mejor? Responde con el número`);
}

module.exports = { manejarMensaje };
