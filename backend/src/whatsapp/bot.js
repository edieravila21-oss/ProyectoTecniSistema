const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const prisma = require('../config/db');
const { getIO } = require('../config/socket');
const { manejarMensaje } = require('./flujo');
const { escribiendoTimestamps } = require('./estado');

const SESSION_DIR = path.join(__dirname, '../../whatsapp_session');

const limpiarSesion = () => {
  if (!fs.existsSync(SESSION_DIR)) return;
  for (const file of fs.readdirSync(SESSION_DIR)) {
    const filePath = path.join(SESSION_DIR, file);
    fs.rmSync(filePath, { recursive: true, force: true });
  }
};

let sock = null;
let estado = { conectado: false, numero_conectado: null };
let reconnectAttempts = 0;
let reconnectTimer = null;
let keepAliveTimer = null;
const MAX_RECONNECT = 20;

const sesiones = new Map();
// Mapa LID → teléfono real (se llena al sincronizar contactos)
const lidToPhone = new Map();
// Mapa pollMessageId → { servicioId, telefono } para calificaciones
const encuestasPendientes = new Map();

const resolverTelefono = (remoteJid) => {
  if (remoteJid.endsWith('@s.whatsapp.net')) {
    return remoteJid.replace('@s.whatsapp.net', '');
  }
  if (remoteJid.endsWith('@lid')) {
    const lidId = remoteJid.replace('@lid', '');
    const phone = lidToPhone.get(lidId);
    if (phone) return phone;
    return lidId;
  }
  return remoteJid;
};

const iniciar = async () => {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['RefriElectri Pro', 'Chrome', '1.0.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  // Mapear LID → teléfono desde todos los eventos posibles
  const registrarContacto = (contact) => {
    if (!contact) return;
    const id = contact.id || '';
    const lid = contact.lid || '';
    // Caso 1: id es phone, lid es LID
    if (id.endsWith('@s.whatsapp.net') && lid.endsWith('@lid')) {
      lidToPhone.set(lid.replace('@lid', ''), id.replace('@s.whatsapp.net', ''));
    }
    // Caso 2: id es LID, buscar phone en otros campos
    if (id.endsWith('@lid') && contact.phone) {
      lidToPhone.set(id.replace('@lid', ''), contact.phone);
    }
  };

  sock.ev.on('contacts.upsert', (contacts) => {
    console.log(`[WhatsApp] contacts.upsert: ${contacts.length} contactos`);
    if (contacts[0]) console.log('[WhatsApp] Ejemplo contacto:', JSON.stringify(Object.keys(contacts[0])));
    for (const c of contacts) registrarContacto(c);
    console.log(`[WhatsApp] LIDs mapeados: ${lidToPhone.size}`);
  });

  sock.ev.on('contacts.update', (updates) => {
    for (const u of updates) registrarContacto(u);
  });

  sock.ev.on('messaging-history.set', (data) => {
    console.log('[WhatsApp] messaging-history.set keys:', Object.keys(data));
    const contacts = data.contacts || [];
    const chats = data.chats || [];
    console.log(`[WhatsApp] Historial: ${contacts.length} contactos, ${chats.length} chats`);
    if (contacts[0]) console.log('[WhatsApp] Ejemplo contacto hist:', JSON.stringify(contacts[0]).substring(0, 300));
    if (chats[0]) console.log('[WhatsApp] Ejemplo chat hist:', JSON.stringify(chats[0]).substring(0, 300));
    for (const c of contacts) registrarContacto(c);
    // También revisar chats por si traen participantes
    for (const chat of chats) {
      if (chat.id && chat.lid) registrarContacto(chat);
      if (chat.participant) {
        for (const p of chat.participant) registrarContacto(p);
      }
    }
    console.log(`[WhatsApp] LIDs mapeados después de historial: ${lidToPhone.size}`);
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      const qrBase64 = await QRCode.toDataURL(qr);
      console.log('[WhatsApp] QR generado — enviando al panel admin');
      try {
        const io = getIO();
        const adminRoom = io.sockets.adapter.rooms.get('admin');
        console.log(`[WhatsApp] Sockets en room admin: ${adminRoom ? adminRoom.size : 0}`);
        io.to('admin').emit('whatsapp_qr', { qr: qrBase64 });
        io.to('admin').emit('whatsapp_estado', { conectado: false });
      } catch (err) {
        console.error('[WhatsApp] Error emitiendo QR:', err.message);
      }
    }

    if (connection === 'close') {
      estado = { conectado: false, numero_conectado: null };
      if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
      try { getIO().to('admin').emit('whatsapp_estado', { conectado: false }); } catch (_) {}

      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect && reconnectAttempts < MAX_RECONNECT) {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 60000); // capped at 60s
        console.log(`[WhatsApp] Reconectando en ${delay / 1000}s (intento ${reconnectAttempts}/${MAX_RECONNECT})`);
        reconnectTimer = setTimeout(iniciar, delay);
      } else if (!shouldReconnect) {
        console.log('[WhatsApp] Sesión cerrada. Escanea un nuevo QR.');
        limpiarSesion();
      } else {
        console.log('[WhatsApp] Límite de reconexiones alcanzado. Borrando sesión para forzar nuevo QR.');
        limpiarSesion();
        estado = { conectado: false, numero_conectado: null };
        try { getIO().to('admin').emit('whatsapp_estado', { conectado: false, requiere_qr: true }); } catch (_) {}
      }
    }

    if (connection === 'open') {
      reconnectAttempts = 0;
      const me = sock.user;
      estado = { conectado: true, numero_conectado: me?.id?.split(':')[0] || null };
      console.log(`[WhatsApp] Conectado como ${estado.numero_conectado}`);
      try { getIO().to('admin').emit('whatsapp_estado', estado); } catch (_) {}

      // Keep-alive: ping cada 2 minutos para evitar desconexiones silenciosas
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      keepAliveTimer = setInterval(async () => {
        if (!sock || !estado.conectado) { clearInterval(keepAliveTimer); keepAliveTimer = null; return; }
        try {
          await sock.sendPresenceUpdate('unavailable');
        } catch (err) {
          console.log('[WhatsApp] Keep-alive falló, reconectando:', err.message);
        }
      }, 2 * 60 * 1000);
    }
  });

  // Detectar cuando el cliente está escribiendo
  sock.ev.on('presence.update', (data) => {
    try {
      const id = data.id || (data.key?.remoteJid);
      if (!id || id.endsWith('@g.us') || id.endsWith('@broadcast')) return;

      const telefono = resolverTelefono(id);
      const presences = data.presences || {};

      for (const jid of Object.keys(presences)) {
        const presence = presences[jid];
        const estado = presence?.lastKnownPresence;
        console.log(`[Presence] ${telefono} → ${estado}`);
        if (estado === 'composing') {
          escribiendoTimestamps.set(telefono, Date.now());
          console.log(`[Typing] ✍️ ${telefono} está escribiendo`);
        } else if (estado === 'paused') {
          console.log(`[Typing] ⏸️ ${telefono} dejó de escribir`);
        }
      }
    } catch (err) {
      console.log('[Presence] Error:', err.message);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message) continue;

      const remoteJid = msg.key.remoteJid;
      if (remoteJid.endsWith('@g.us') || remoteJid.endsWith('@broadcast')) continue;

      // Los votos de encuesta se procesan en messages.update, no aquí
      if (msg.message.pollUpdateMessage) continue;

      if (msg.key.fromMe) continue;

      // Resolver teléfono real: preferir remoteJidAlt (tiene el número), fallback a remoteJid
      const jidReal = msg.key.remoteJidAlt || remoteJid;
      const telefono = jidReal.replace('@s.whatsapp.net', '').replace('@lid', '');

      // Guardar mapeo LID→phone para uso futuro
      if (remoteJid.endsWith('@lid') && msg.key.remoteJidAlt?.endsWith('@s.whatsapp.net')) {
        const lidId = remoteJid.replace('@lid', '');
        lidToPhone.set(lidId, telefono);
      }

      const contenido = msg.message.conversation
        || msg.message.extendedTextMessage?.text
        || '[media]';

      console.log(`[WhatsApp] Mensaje de ${telefono} (${msg.pushName || 'sin nombre'}): ${contenido}`);

      // Todo no-bloqueante para que el loop procese todos los mensajes del lote rápido
      sock.presenceSubscribe(remoteJid).catch(() => {});

      prisma.mensajeWhatsApp.create({
        data: {
          telefono,
          direccion: 'entrante',
          contenido,
          tipo: 'texto',
          estado: 'pendiente',
          sesion_id: telefono,
        },
      }).catch(err => console.error('[WhatsApp] Error guardando mensaje:', err.message));

      try {
        getIO().to('admin').emit('whatsapp_mensaje', { telefono, contenido, timestamp: new Date() });
        getIO().to('admin').emit('whatsapp_conversacion_update', { telefono });
      } catch (_) {}

      manejarMensaje(sock, telefono, jidReal, contenido, sesiones).catch(err => {
        console.error('[WhatsApp] Error manejando mensaje:', err.message);
      });
    }
  });

  // Procesar votos de encuestas de calificación
  sock.ev.on('messages.update', async (updates) => {
    for (const update of updates) {
      const pollUpdate = update.update?.pollUpdates;
      if (!pollUpdate || pollUpdate.length === 0) continue;

      const pollMsgKey = update.key?.id;
      if (!pollMsgKey || !encuestasPendientes.has(pollMsgKey)) continue;

      const { servicioId, telefono: telCliente } = encuestasPendientes.get(pollMsgKey);
      const opciones = ['⭐ Malo', '⭐⭐ Regular', '⭐⭐⭐ Bueno', '⭐⭐⭐⭐ Muy bueno', '⭐⭐⭐⭐⭐ Excelente'];

      try {
        const { decryptPollVote } = require('@whiskeysockets/baileys');
        for (const pUpdate of pollUpdate) {
          const votes = pUpdate.vote?.selectedOptions || [];
          if (votes.length === 0) continue;

          // Descifrar SHA256 de las opciones para mapear el voto
          const crypto = require('crypto');
          const opcionHashes = opciones.map(op => crypto.createHash('sha256').update(op).digest());

          let calificacion = 0;
          for (const voteHash of votes) {
            const idx = opcionHashes.findIndex(h => h.equals(voteHash));
            if (idx !== -1) {
              calificacion = idx + 1;
              break;
            }
          }

          if (calificacion >= 1 && calificacion <= 5) {
            await prisma.servicio.update({ where: { id: servicioId }, data: { calificacion_cliente: calificacion } });
            const jid = telCliente.includes('@') ? telCliente : `${telCliente}@s.whatsapp.net`;
            await sock.sendMessage(jid, {
              text: calificacion >= 4
                ? '¡Muchas gracias por tu calificación! Nos alegra que hayas tenido una buena experiencia 😊'
                : '¡Gracias por tu opinión! Trabajaremos para mejorar 💪',
            });
            encuestasPendientes.delete(pollMsgKey);
            console.log(`[WhatsApp] Calificación ${calificacion}⭐ (${opciones[calificacion - 1]}) guardada para servicio ${servicioId}`);
            try { getIO().to('admin').emit('servicio_calificado', { servicioId, calificacion }); } catch (_) {}
          } else {
            console.log(`[WhatsApp] Voto no mapeado. Hashes recibidos: ${votes.length}, opciones: ${opciones.length}`);
          }
        }
      } catch (err) {
        console.error('[WhatsApp] Error procesando voto de encuesta:', err.message);
      }
    }
  });

  return sock;
};

const enviarMensaje = async (telefono, mensaje) => {
  if (!sock || !estado.conectado) {
    console.log(`[WhatsApp] No conectado. Mensaje para ${telefono}: ${mensaje}`);
    return false;
  }

  const jid = telefono.includes('@') ? telefono : `${telefono}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text: mensaje });

  await prisma.mensajeWhatsApp.create({
    data: {
      telefono: telefono.replace(/@s\.whatsapp\.net|@lid/g, ''),
      direccion: 'saliente',
      contenido: mensaje,
      tipo: 'texto',
      estado: 'procesado',
    },
  });

  return true;
};

const enviarEncuestaCalificacion = async (telefono, servicioId) => {
  if (!sock || !estado.conectado) return false;

  const jid = telefono.includes('@') ? telefono : `${telefono}@s.whatsapp.net`;
  const pollMsg = await sock.sendMessage(jid, {
    poll: {
      name: '⭐ ¿Cómo calificas nuestro servicio?',
      values: ['⭐ Malo', '⭐⭐ Regular', '⭐⭐⭐ Bueno', '⭐⭐⭐⭐ Muy bueno', '⭐⭐⭐⭐⭐ Excelente'],
      selectableCount: 1,
    },
  });

  // Guardar referencia poll → servicio para cuando llegue el voto
  if (pollMsg?.key?.id) {
    encuestasPendientes.set(pollMsg.key.id, { servicioId, telefono });
  }

  return true;
};

const getEstado = () => estado;

const conectar = async () => {
  if (estado.conectado) return;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectAttempts = 0;
  if (sock) {
    try { sock.end(undefined); } catch (_) {}
    sock = null;
  }
  estado = { conectado: false, numero_conectado: null };
  await iniciar();
};

const desconectar = async () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
  reconnectAttempts = MAX_RECONNECT;
  if (sock) {
    try { sock.end(undefined); } catch (_) {}
    sock = null;
  }
  limpiarSesion();
  estado = { conectado: false, numero_conectado: null };
  try { getIO().to('admin').emit('whatsapp_estado', estado); } catch (_) {}
};

module.exports = { iniciar, enviarMensaje, enviarEncuestaCalificacion, getEstado, conectar, desconectar };
