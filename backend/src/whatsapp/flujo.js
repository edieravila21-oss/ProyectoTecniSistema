const prisma = require('../config/db');
const { getIO } = require('../config/socket');
const { getChecklistPorTipo } = require('../services/checklistService');
const { obtenerDisponibilidad, asignarTecnicoParaSlot } = require('../services/disponibilidadService');
const { generarRespuestaCompleta, iaDisponible } = require('../services/iaService');
const { escribiendoTimestamps } = require('./estado');
const { formatCurrency } = require('../utils/helpers');

const TIMEOUT_MS = 30 * 60 * 1000;

let configAsesora = { nombre: 'nuestra asesora', telefono: null };

const escalarAHumano = async (sock, telefono, sesion, razon, enviar, sesiones) => {
  const nombre = sesion?.datos?.nombre || 'Cliente';
  await enviar(`Voy a pasar tu caso a ${configAsesora.nombre}, nuestra asesora. Ella te contactará pronto 🙌`);
  await upsertConversacion(telefono, { estado: 'escalado', bot_activo: false, ultimo_mensaje: razon });
  try { getIO().to('admin').emit('whatsapp_escalado', { telefono, nombre, razon }); } catch (_) {}

  if (configAsesora.telefono) {
    try {
      const asesoraJid = `${configAsesora.telefono}@s.whatsapp.net`;
      await sock.sendMessage(asesoraJid, {
        text: `📢 *Escalación — ${nombre}*\n\n📱 Teléfono: ${telefono}\n📝 Motivo: ${razon}\n\nEl bot se desactivó para este chat. Respóndele directamente al cliente.`,
      });
    } catch (err) {
      console.error('[WhatsApp] Error notificando asesora:', err.message);
    }
  }

  sesiones.delete(telefono);
};

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
      configAsesora = {
        nombre: config.asesora_nombre || 'nuestra asesora',
        telefono: config.asesora_telefono || null,
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
  const valorDiagnostico = config?.valor_diagnostico || 40000;

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
    const opcionesTexto = slots.map((s, i) => `${i + 1}. ${s.diaLabel} de ${s.label} — 👨‍🔧 ${s.tecnicoNombre}`).join('\n');

    // Detectar si el cliente quiere salir del flujo de horarios
    const contenidoLower = contenidoCompleto.toLowerCase();
    const quiereSalir = /ningun|ningún|no me sirve|no puedo|cancel|no quiero|hablar con|humano|asesor|llamar|llam[ea]/i.test(contenidoLower);

    if (quiereSalir) {
      return await escalarAHumano(sock, telefono, sesion, 'Horarios no le sirven', enviar, sesiones);
    }

    // Detectar preguntas fuera de contexto (precio, técnico, etc.)
    const preguntaFuera = /precio|costo|cuánto|cuanto|técnico|tecnico|quien viene/i.test(contenidoLower);
    if (preguntaFuera) {
      let respExtra = '';
      if (/precio|costo|cuánto|cuanto/i.test(contenidoLower)) {
        respExtra = `El diagnóstico tiene un costo de ${formatCurrency(valorDiagnostico)}. El valor de la reparación depende de lo que encuentre el técnico.\n\n`;
      }
      await enviar(`${respExtra}¿Cuál horario te queda mejor? Responde con el número del 1 al ${slots.length} 😊\n\n${opcionesTexto}`);
      return;
    }

    // La IA interpreta la respuesta del cliente
    const respIA = await generarRespuestaCompleta({
      negocio,
      nombre: sesion.datos.nombre || cliente?.nombre || null,
      historial: sesion.historial,
      datosRecolectados: sesion.datos,
      mensaje: `El cliente debe elegir un horario de estas opciones:\n${opcionesTexto}\n\nEl cliente respondió: "${contenidoCompleto}"\n\nResponde SOLO con el número de la opción que eligió (1, 2, 3 o 4). Si no se entiende qué eligió, responde "0".`,
      contextoCliente: '',
      valorDiagnostico,
    });

    const opcion = parseInt((respIA || '').match(/(\d+)/)?.[1]) || 0;

    if (!opcion || opcion < 1 || opcion > slots.length) {
      await enviar(`No logré identificar el horario. ¿Me dices el número del 1 al ${slots.length}? 😊\n\n${opcionesTexto}\n\nSi ninguno te sirve, escribe "ninguno" y te paso con un asesor.`);
      return;
    }

    const slotElegido = slots[opcion - 1];

    // Verificar que el slot siga disponible (evitar doble booking)
    const tecnico = await asignarTecnicoParaSlot(sesion.datos.tipo_equipo || 'otro', slotElegido.fechaKey, slotElegido.hora_inicio);
    if (!tecnico) {
      const nuevosSlots = await obtenerDisponibilidad(sesion.datos.tipo_equipo || 'otro', 7, 4);
      if (nuevosSlots.length === 0) {
        return await escalarAHumano(sock, telefono, sesion, 'Sin disponibilidad — slot ya tomado', enviar, sesiones);
      }
      sesion.datos.slots = nuevosSlots.map(s => ({
        fecha: s.fecha, fechaKey: s.fechaKey, hora_inicio: s.hora_inicio, hora_fin: s.hora_fin,
        diaLabel: s.diaLabel, label: s.label, tecnicoId: s.tecnico.id, tecnicoNombre: s.tecnico.nombre,
      }));
      const nuevasOpciones = nuevosSlots.map((s, i) => `${i + 1}. ${s.diaLabel} de ${s.label} — 👨‍🔧 ${s.tecnico.nombre}`);
      await enviar(`Ese horario ya fue tomado 😅 Pero tengo estos otros disponibles:\n\n${nuevasOpciones.join('\n')}\n\n¿Cuál te sirve?`);
      return;
    }

    const tecnicoId = tecnico.id;
    const tecnicoNombre = tecnico.nombre;

    const tipoLabel = { nevera: 'Nevera', aire_acondicionado: 'Aire acondicionado', otro: 'Otro equipo' };

    let clienteId = sesion.datos.clienteId;
    if (!clienteId) {
      const nuevoCliente = await prisma.cliente.upsert({
        where: { telefono },
        update: { nombre: sesion.datos.nombre || undefined, direccion_principal: sesion.datos.direccion || undefined },
        create: { nombre: sesion.datos.nombre || 'Cliente WhatsApp', telefono, direccion_principal: sesion.datos.direccion },
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

    const tipoServicio = sesion.datos.tipo_servicio || 'reparacion';
    const checklistItems = getChecklistPorTipo(sesion.datos.tipo_equipo || 'otro', tipoServicio);

    const servicio = await prisma.servicio.create({
      data: {
        clienteId, equipoId, tecnicoId,
        estado: 'asignado',
        tipo_servicio: tipoServicio,
        descripcion_falla: sesion.datos.falla || 'No especificada',
        fecha_programada: new Date(slotElegido.fecha),
        hora_inicio: slotElegido.hora_inicio, hora_fin: slotElegido.hora_fin,
        direccion_servicio: sesion.datos.direccion || 'Por confirmar',
        valor_estimado: valorDiagnostico,
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
      `¡Listo ${sesion.datos.nombre || 'cliente'}! Tu servicio quedó agendado:\n📅 ${slotElegido.diaLabel} de ${slotElegido.label}\n📍 ${sesion.datos.direccion || 'Por confirmar'}\n🔧 ${tipoLabel[sesion.datos.tipo_equipo] || 'Equipo'}${sesion.datos.marca ? ' ' + sesion.datos.marca : ''}\n👨‍🔧 Técnico: ${tecnicoNombre}\n💰 Diagnóstico: ${formatCurrency(valorDiagnostico)}\n\nTe avisaremos antes de la llegada del técnico. ¡Gracias por confiar en ${negocio}!`
    );

    try {
      const tecnicoUser = await prisma.usuario.findUnique({ where: { id: tecnicoId }, select: { telefono: true } });
      if (tecnicoUser?.telefono) {
        const tecJid = `${tecnicoUser.telefono}@s.whatsapp.net`;
        await sock.sendMessage(tecJid, {
          text: `📋 *Nuevo servicio asignado*\n\n👤 Cliente: ${sesion.datos.nombre || 'Cliente'}\n📍 Dirección: ${sesion.datos.direccion || 'Por confirmar'}\n📅 Fecha: ${slotElegido.diaLabel}\n🕐 Horario: ${slotElegido.label}\n🔧 Equipo: ${tipoLabel[sesion.datos.tipo_equipo] || 'Equipo'}${sesion.datos.marca ? ' ' + sesion.datos.marca : ''}\n📝 Problema: ${sesion.datos.falla || 'No especificada'}\n💰 Diagnóstico: ${formatCurrency(valorDiagnostico)}`,
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

    // Cambiar a paso post-agendamiento (no borrar sesión inmediatamente)
    sesion.paso = 'post_agendamiento';
    return;
  }

  // ═══════════════════════════════════════════════
  // PASO: POST AGENDAMIENTO — evitar servicios fantasma
  // ═══════════════════════════════════════════════
  if (sesion.paso === 'post_agendamiento') {
    const contenidoLower = contenidoCompleto.toLowerCase();

    // Respuestas casuales → responder amablemente sin crear nada
    const esCasual = /^(ok|listo|gracias|está bien|esta bien|bueno|vale|perfecto|los espero|espero|chao|bye|adiós|adios|dale|genial|bien|este|el que|ya)\b/i.test(contenidoLower.trim());
    if (esCasual) {
      await enviar(`¡Con gusto! Si necesitas algo más, escríbenos 😊`);
      await upsertConversacion(telefono, { ultimo_mensaje: contenidoCompleto });
      sesiones.delete(telefono);
      return;
    }

    // Si quiere otro servicio, reiniciar conversación
    const quiereOtroServicio = /otro servicio|otro equipo|también|tambien|mantenimiento|revisión|revision|necesito|quiero que|programar|agendar/i.test(contenidoLower);
    if (quiereOtroServicio) {
      sesion.paso = 'conversar';
      sesion.datos = { nombre: sesion.datos.nombre, clienteId: sesion.datos.clienteId };
      // Continuar al paso conversar (no return, caerá al bloque de abajo)
    } else {
      // Cualquier otra cosa (cancelar, cambiar técnico, preguntas) → escalar
      return await escalarAHumano(sock, telefono, sesion, contenidoCompleto, enviar, sesiones);
    }
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
      valorDiagnostico,
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

    const tipoServMatch = resp.match(/\[TIPO_SERVICIO:([^\]]+)\]/);
    if (tipoServMatch) sesion.datos.tipo_servicio = tipoServMatch[1].trim();

    const fallaMatch = resp.match(/\[FALLA:([^\]]+)\]/);
    if (fallaMatch) sesion.datos.falla = fallaMatch[1].trim();

    const direccionMatch = resp.match(/\[DIRECCION:([^\]]+)\]/);
    if (direccionMatch) sesion.datos.direccion = direccionMatch[1].trim();

    const referenciaMatch = resp.match(/\[REFERENCIA:([^\]]+)\]/);
    if (referenciaMatch) sesion.datos.referencia = referenciaMatch[1].trim();

    // Validar datos mínimos antes de agendar
    if (resp.includes('[AGENDAR]')) {
      if (!sesion.datos.tipo_equipo || !sesion.datos.direccion) {
        const falta = [];
        if (!sesion.datos.tipo_equipo) falta.push('qué tipo de equipo es (aire o nevera)');
        if (!sesion.datos.direccion) falta.push('la dirección para el servicio');
        const mensajeLimpio = resp
          .replace(/\[.*?\]/g, '')
          .trim();
        await upsertConversacion(telefono, { estado: 'en_conversacion', ultimo_mensaje: contenidoCompleto });
        await enviar(mensajeLimpio || `Me falta saber ${falta.join(' y ')} para poder agendar. ¿Me ayudas con eso? 😊`);
        return;
      }
      return await procesarAgendamiento(sock, telefono, remoteJid, sesion, enviar, config, negocio, sesiones);
    }

    if (resp.includes('[ESCALAR]')) {
      return await escalarAHumano(sock, telefono, sesion, contenidoCompleto, enviar, sesiones);
    }

    const mensajeLimpio = resp
      .replace(/\[[A-Z_]+:[^\]]*\]/g, '')
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

async function procesarAgendamiento(sock, telefono, remoteJid, sesion, enviar, config, negocio, sesiones) {
  const tipoLabel = { nevera: 'Nevera', aire_acondicionado: 'Aire acondicionado', otro: 'Otro equipo' };
  const tipo = sesion.datos.tipo_equipo || 'otro';

  const slots = await obtenerDisponibilidad(tipo, 7, 4);

  if (slots.length === 0) {
    return await escalarAHumano(sock, telefono, sesion, 'Sin disponibilidad técnica', enviar, sesiones);
  }

  sesion.datos.slots = slots.map(s => ({
    fecha: s.fecha, fechaKey: s.fechaKey, hora_inicio: s.hora_inicio, hora_fin: s.hora_fin,
    diaLabel: s.diaLabel, label: s.label, tecnicoId: s.tecnico.id, tecnicoNombre: s.tecnico.nombre,
  }));

  const resumen = `Perfecto, te confirmo los datos:\n🔧 Equipo: ${tipoLabel[tipo] || tipo}${sesion.datos.marca ? ' ' + sesion.datos.marca : ''}\n📝 Problema: ${sesion.datos.falla || 'No especificado'}\n📍 Dirección: ${sesion.datos.direccion || 'Por confirmar'}${sesion.datos.referencia ? '\n📍 Referencia: ' + sesion.datos.referencia : ''}`;

  const opciones = slots.map((s, i) => `${i + 1}. ${s.diaLabel} de ${s.label} — 👨‍🔧 ${s.tecnico.nombre}`);

  sesion.paso = 'elegir_fecha';
  await enviar(`${resumen}\n\nConsulté la agenda y tenemos técnicos disponibles:\n${opciones.join('\n')}\n\n¿Cuál horario te funciona mejor? Responde con el número 😊\nSi ninguno te sirve, escribe "ninguno".`);
}

module.exports = { manejarMensaje };
