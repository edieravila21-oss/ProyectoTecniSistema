const prisma = require('../config/db');
const { paginar, respuestaPaginada } = require('../utils/helpers');

const listarConversaciones = async (req, res, next) => {
  try {
    const conversaciones = await prisma.conversacionWhatsApp.findMany({
      include: {
        cliente: { select: { id: true, nombre: true, telefono: true } },
        servicio: { select: { id: true, estado: true, fecha_programada: true, descripcion_falla: true } },
      },
      orderBy: { ultimo_mensaje_at: 'desc' },
    });

    res.json({ success: true, data: conversaciones });
  } catch (error) {
    next(error);
  }
};

const obtenerConversacion = async (req, res, next) => {
  try {
    const { telefono } = req.params;
    const mensajes = await prisma.mensajeWhatsApp.findMany({
      where: { telefono },
      orderBy: { createdAt: 'asc' },
    });

    const conversacion = await prisma.conversacionWhatsApp.findUnique({
      where: { telefono },
      include: {
        cliente: { select: { id: true, nombre: true, telefono: true, direccion_principal: true } },
        servicio: { select: { id: true, estado: true, fecha_programada: true, descripcion_falla: true, tecnico: { select: { nombre: true } } } },
      },
    });

    res.json({ success: true, data: { conversacion, mensajes } });
  } catch (error) {
    next(error);
  }
};

const cambiarEstado = async (req, res, next) => {
  try {
    const { telefono } = req.params;
    const { estado } = req.body;

    const validos = ['nuevo', 'en_conversacion', 'agendado', 'escalado', 'bot_pausado', 'completado'];
    if (!validos.includes(estado)) {
      return res.status(400).json({ success: false, error: 'Estado inválido', code: 'VALIDATION_ERROR' });
    }

    const conversacion = await prisma.conversacionWhatsApp.update({
      where: { telefono },
      data: { estado },
      include: {
        cliente: { select: { id: true, nombre: true } },
        servicio: { select: { id: true, estado: true } },
      },
    });

    res.json({ success: true, data: conversacion });
  } catch (error) {
    next(error);
  }
};

const toggleBot = async (req, res, next) => {
  try {
    const { telefono } = req.params;

    const conv = await prisma.conversacionWhatsApp.findUnique({ where: { telefono } });
    if (!conv) {
      return res.status(404).json({ success: false, error: 'Conversación no encontrada', code: 'NOT_FOUND' });
    }

    const nuevoEstado = !conv.bot_activo;
    const conversacion = await prisma.conversacionWhatsApp.update({
      where: { telefono },
      data: {
        bot_activo: nuevoEstado,
        estado: nuevoEstado ? conv.estado === 'bot_pausado' ? 'en_conversacion' : conv.estado : 'bot_pausado',
      },
      include: {
        cliente: { select: { id: true, nombre: true } },
      },
    });

    res.json({ success: true, data: conversacion });
  } catch (error) {
    next(error);
  }
};

const agregarNota = async (req, res, next) => {
  try {
    const { telefono } = req.params;
    const { notas_admin } = req.body;

    const conversacion = await prisma.conversacionWhatsApp.update({
      where: { telefono },
      data: { notas_admin },
    });

    res.json({ success: true, data: conversacion });
  } catch (error) {
    next(error);
  }
};

const estadoBot = async (req, res, next) => {
  try {
    const whatsappModule = require('../whatsapp/bot');
    const estado = whatsappModule.getEstado();
    res.json({ success: true, data: estado });
  } catch (error) {
    res.json({ success: true, data: { conectado: false, numero_conectado: null } });
  }
};

const conectar = async (req, res, next) => {
  try {
    const whatsappModule = require('../whatsapp/bot');
    await whatsappModule.conectar();
    res.json({ success: true, data: { message: 'Conexión iniciada' } });
  } catch (error) {
    next(error);
  }
};

const desconectar = async (req, res, next) => {
  try {
    const whatsappModule = require('../whatsapp/bot');
    await whatsappModule.desconectar();
    res.json({ success: true, data: { message: 'Desconectado' } });
  } catch (error) {
    next(error);
  }
};

const eliminarConversacion = async (req, res, next) => {
  try {
    const { telefono } = req.params;

    await prisma.mensajeWhatsApp.deleteMany({ where: { telefono } });
    await prisma.conversacionWhatsApp.delete({ where: { telefono } });

    res.json({ success: true, data: { message: 'Conversación eliminada' } });
  } catch (error) {
    next(error);
  }
};

module.exports = { listarConversaciones, obtenerConversacion, cambiarEstado, toggleBot, agregarNota, estadoBot, conectar, desconectar, eliminarConversacion };
