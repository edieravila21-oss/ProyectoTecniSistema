const prisma = require('../config/db');
const { getIO } = require('../config/socket');
const { uploadToCloudinary, uploadBase64ToCloudinary } = require('../config/cloudinary');
const { getChecklistPorTipo } = require('../services/checklistService');
const { validarTransicion, paginar, respuestaPaginada } = require('../utils/helpers');

const listar = async (req, res, next) => {
  try {
    const { fecha, tecnico_id, estado, cliente_id, desde, hasta, origen, page = 1, limit = 20 } = req.query;
    const where = {};

    if (tecnico_id) where.tecnicoId = tecnico_id;
    if (estado) where.estado = estado;
    if (cliente_id) where.clienteId = cliente_id;
    if (origen) where.origen = origen;

    if (fecha) {
      const start = new Date(fecha);
      start.setHours(0, 0, 0, 0);
      const end = new Date(fecha);
      end.setHours(23, 59, 59, 999);
      where.fecha_programada = { gte: start, lte: end };
    } else if (desde && hasta) {
      where.fecha_programada = { gte: new Date(desde), lte: new Date(hasta) };
    }

    const [servicios, total] = await Promise.all([
      prisma.servicio.findMany({
        where,
        include: {
          cliente: { select: { id: true, nombre: true, telefono: true } },
          tecnico: { select: { id: true, nombre: true, foto_url: true } },
          equipo: { select: { id: true, tipo: true, marca: true, modelo: true } },
        },
        orderBy: [{ fecha_programada: 'asc' }, { hora_inicio: 'asc' }],
        ...paginar(page, limit),
      }),
      prisma.servicio.count({ where }),
    ]);

    res.json({ success: true, ...respuestaPaginada(servicios, total, page, limit) });
  } catch (error) {
    next(error);
  }
};

const obtener = async (req, res, next) => {
  try {
    const servicio = await prisma.servicio.findUnique({
      where: { id: req.params.id },
      include: {
        cliente: true,
        tecnico: { select: { id: true, nombre: true, telefono: true, foto_url: true, especialidad: true } },
        equipo: true,
        checklist: { orderBy: { orden: 'asc' } },
        fotos: { orderBy: { subida_at: 'desc' } },
        firma: true,
        eventos: {
          include: { usuario: { select: { id: true, nombre: true, rol: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!servicio) {
      return res.status(404).json({ success: false, error: 'Servicio no encontrado', code: 'NOT_FOUND' });
    }

    res.json({ success: true, data: servicio });
  } catch (error) {
    next(error);
  }
};

const crear = async (req, res, next) => {
  try {
    const {
      clienteId, equipoId, tecnicoId, descripcion_falla, fecha_programada,
      hora_inicio, hora_fin, direccion_servicio, valor_estimado, notas_admin, origen, tipo_servicio,
    } = req.body;

    if (!clienteId) {
      return res.status(400).json({ success: false, error: 'El cliente es requerido', code: 'VALIDATION_ERROR' });
    }

    let tipoEquipo = 'otro';
    if (equipoId) {
      const equipo = await prisma.equipo.findUnique({ where: { id: equipoId } });
      if (equipo) tipoEquipo = equipo.tipo;
    }

    const checklistItems = getChecklistPorTipo(tipoEquipo, tipo_servicio);

    const servicio = await prisma.servicio.create({
      data: {
        clienteId,
        equipoId,
        tecnicoId,
        estado: tecnicoId ? 'asignado' : 'pendiente',
        tipo_servicio: tipo_servicio || null,
        descripcion_falla,
        fecha_programada: fecha_programada ? new Date(fecha_programada) : null,
        hora_inicio,
        hora_fin,
        direccion_servicio,
        valor_estimado,
        notas_admin,
        origen: origen || 'manual',
        checklist: {
          create: checklistItems,
        },
        eventos: {
          create: {
            tipo: 'creado',
            descripcion: 'Servicio creado',
            usuarioId: req.usuario?.id ?? null,
          },
        },
      },
      include: {
        cliente: true,
        tecnico: { select: { id: true, nombre: true } },
        equipo: true,
        checklist: { orderBy: { orden: 'asc' } },
        eventos: true,
      },
    });

    if (tecnicoId) {
      await prisma.eventoServicio.create({
        data: {
          servicioId: servicio.id,
          tipo: 'asignado',
          descripcion: `Servicio asignado a ${servicio.tecnico?.nombre || 'técnico'}`,
          usuarioId: req.usuario?.id ?? null,
        },
      });

      const tecnicoData = await prisma.usuario.findUnique({ where: { id: tecnicoId } });
      if (tecnicoData?.telefono) {
        const { enviarMensaje } = require('../whatsapp/bot');
        const cliente = servicio.cliente?.nombre || 'Cliente';
        const equipo = servicio.equipo
          ? `${servicio.equipo.tipo === 'aire_acondicionado' ? 'aire acondicionado' : servicio.equipo.tipo === 'nevera' ? 'nevera' : 'equipo'} ${servicio.equipo.marca || ''}`.trim()
          : 'equipo';
        const fecha = servicio.fecha_programada ? new Date(servicio.fecha_programada).toLocaleDateString('es-CO') : 'Por definir';
        const hora = servicio.hora_inicio || 'Por definir';
        const msg = `🔧 *RefriElectri Pro — Nuevo Servicio Asignado*\n\n👤 Cliente: *${cliente}*\n🏠 Dirección: ${servicio.direccion_servicio || 'Por definir'}\n📅 Fecha: ${fecha}\n🕐 Hora: ${hora}\n🔌 Equipo: ${equipo}\n⚠️ Falla: ${servicio.descripcion_falla || 'No especificada'}\n\nRevisa tu app para más detalles.`;
        try { await enviarMensaje(tecnicoData.telefono, msg); } catch (err) { console.error('[WhatsApp] Error notificando técnico:', err.message); }
      }
    }

    try { getIO().to('admin').emit('nuevo_servicio', servicio); } catch (_) {}

    res.status(201).json({ success: true, data: servicio });
  } catch (error) {
    next(error);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const esAdmin = req.usuario.rol === 'admin';
    const servicioActual = await prisma.servicio.findUnique({ where: { id: req.params.id } });
    if (!servicioActual) return res.status(404).json({ success: false, error: 'Servicio no encontrado' });

    const esTecnicoAsignado = servicioActual.tecnicoId === req.usuario.id;
    if (!esAdmin && !esTecnicoAsignado) {
      return res.status(403).json({ success: false, error: 'No tienes permiso para editar este servicio' });
    }

    const {
      descripcion_falla, fecha_programada, hora_inicio, hora_fin,
      direccion_servicio, valor_estimado, valor_final, metodo_pago,
      notas_admin, notas_tecnico,
    } = req.body;

    const data = {};
    if (esAdmin) {
      Object.assign(data, {
        descripcion_falla, fecha_programada: fecha_programada ? new Date(fecha_programada) : undefined,
        hora_inicio, hora_fin, direccion_servicio, valor_estimado,
        valor_final, metodo_pago, notas_admin, notas_tecnico,
      });
    } else {
      const { falla_confirmada, diagnostico_final, repuestos } = req.body;
      Object.assign(data, { valor_final, metodo_pago, notas_tecnico, falla_confirmada, diagnostico_final, repuestos });
    }

    const servicio = await prisma.servicio.update({
      where: { id: req.params.id },
      data,
      include: {
        cliente: true,
        tecnico: { select: { id: true, nombre: true } },
        equipo: true,
      },
    });

    try { getIO().to('admin').emit('servicio_actualizado', servicio); } catch (_) {}

    res.json({ success: true, data: servicio });
  } catch (error) {
    next(error);
  }
};

const cambiarEstado = async (req, res, next) => {
  try {
    const { estado } = req.body;
    const servicio = await prisma.servicio.findUnique({
      where: { id: req.params.id },
      include: {
        cliente: true,
        tecnico: { select: { id: true, nombre: true } },
        checklist: true,
        fotos: true,
        firma: true,
      },
    });

    if (!servicio) {
      return res.status(404).json({ success: false, error: 'Servicio no encontrado', code: 'NOT_FOUND' });
    }

    if (estado === 'cancelado' && req.usuario.rol !== 'admin') {
      return res.status(403).json({ success: false, error: 'Solo el admin puede cancelar servicios', code: 'FORBIDDEN' });
    }

    if (estado !== 'cancelado' && !validarTransicion(servicio.estado, estado)) {
      return res.status(400).json({
        success: false,
        error: `No se puede cambiar de ${servicio.estado} a ${estado}`,
        code: 'INVALID_TRANSITION',
      });
    }

    if (estado === 'completado') {
      const pendientes = servicio.checklist.filter(c => !c.completado);
      if (pendientes.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Faltan ${pendientes.length} items del checklist por completar`,
          code: 'CHECKLIST_INCOMPLETO',
          data: { pendientes: pendientes.map(p => p.descripcion) },
        });
      }

      const tieneFotoDespues = servicio.fotos.some(f => f.tipo === 'despues');
      if (!tieneFotoDespues) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere al menos una foto "después" para cerrar el servicio',
          code: 'FOTO_REQUERIDA',
        });
      }

      if (!servicio.firma) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere la firma del cliente para cerrar el servicio',
          code: 'FIRMA_REQUERIDA',
        });
      }
    }

    const updateData = { estado };
    if (estado === 'en_servicio') updateData.fecha_inicio_real = new Date();
    if (estado === 'completado') updateData.fecha_fin_real = new Date();

    const actualizado = await prisma.servicio.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        cliente: true,
        tecnico: { select: { id: true, nombre: true } },
        equipo: true,
        fotos: true,
      },
    });

    await prisma.eventoServicio.create({
      data: {
        servicioId: req.params.id,
        tipo: estado === 'en_servicio' ? 'en_servicio' : estado === 'en_camino' ? 'en_camino' : estado,
        descripcion: `Estado cambiado a ${estado}`,
        usuarioId: req.usuario.id,
      },
    });

    try {
      getIO().to('admin').emit('servicio_actualizado', actualizado);
      getIO().to(`servicio_${req.params.id}`).emit('servicio_actualizado', actualizado);
    } catch (_) {}

    // WhatsApp notifications to client on key state changes
    if (['en_camino', 'en_servicio', 'completado'].includes(estado) && actualizado.cliente?.telefono) {
      const { enviarMensaje, enviarEncuestaCalificacion } = require('../whatsapp/bot');
      const tecnico = actualizado.tecnico?.nombre || 'Tu técnico';
      const cliente = actualizado.cliente?.nombre?.split(' ')[0] || '';
      const equipo = actualizado.equipo
        ? `${actualizado.equipo.tipo === 'aire_acondicionado' ? 'aire acondicionado' : actualizado.equipo.tipo === 'nevera' ? 'nevera' : 'equipo'} ${actualizado.equipo.marca || ''}`.trim()
        : 'equipo';
      const mensajes = {
        en_camino: `🚗 Hola ${cliente}, *${tecnico}* va en camino a atender tu ${equipo}.`,
        en_servicio: `✅ ${cliente}, *${tecnico}* ya llegó y comenzará el servicio.`,
        completado: `🎉 ${cliente}, tu servicio fue completado por *${tecnico}*.${actualizado.valor_final ? ` Valor: $${actualizado.valor_final.toLocaleString('es-CO')}` : ''} ¡Gracias!`,
      };
      try {
        await enviarMensaje(actualizado.cliente.telefono, mensajes[estado]);
        if (estado === 'completado') {
          const { enviarImagen } = require('../whatsapp/bot');
          const tel = actualizado.cliente.telefono;

          // Resumen del trabajo
          const repuestosTxt = actualizado.repuestos?.length
            ? actualizado.repuestos.map(r => `• ${r.nombre} x${r.cantidad}`).join('\n')
            : null;
          let resumen = `📋 *Resumen del servicio*\n🔧 ${equipo}\n👨‍🔧 Técnico: ${tecnico}`;
          if (actualizado.notas_tecnico) resumen += `\n📝 ${actualizado.notas_tecnico}`;
          if (repuestosTxt) resumen += `\n\n🔩 *Repuestos:*\n${repuestosTxt}`;
          if (actualizado.valor_final) resumen += `\n\n💰 Total: $${actualizado.valor_final.toLocaleString('es-CO')}`;

          setTimeout(async () => {
            try {
              await enviarMensaje(tel, resumen);

              // Enviar fotos antes/después
              const fotos = actualizado.fotos || [];
              const fotoAntes = fotos.find(f => f.tipo === 'antes');
              const fotoDespues = fotos.find(f => f.tipo === 'despues');
              if (fotoAntes) await enviarImagen(tel, fotoAntes.url, '📷 Antes del servicio');
              if (fotoDespues) await enviarImagen(tel, fotoDespues.url, '📷 Después del servicio');

              // Encuesta de calificación
              await enviarEncuestaCalificacion(tel, actualizado.id);
              console.log(`[WhatsApp] Resumen + encuesta enviados a ${tel}`);
            } catch (err) {
              console.error('[WhatsApp] Error enviando resumen:', err.message);
            }
          }, 3000);
        }
      } catch (err) {
        console.error('[WhatsApp] Error enviando notificación:', err.message);
      }
    }

    // Auto-create maintenance reminder when service completes
    if (estado === 'completado' && actualizado.equipoId) {
      try {
        const config = await prisma.configuracion.findFirst();
        const meses = config?.meses_recordatorio || 6;
        const proximaFecha = new Date();
        proximaFecha.setMonth(proximaFecha.getMonth() + meses);

        await prisma.recordatorioMantenimiento.upsert({
          where: {
            id: (await prisma.recordatorioMantenimiento.findFirst({
              where: { clienteId: actualizado.clienteId, equipoId: actualizado.equipoId },
            }))?.id || 'none',
          },
          update: {
            fecha_ultimo_servicio: new Date(),
            fecha_proximo_recordatorio: proximaFecha,
            enviado: false,
            enviado_at: null,
          },
          create: {
            clienteId: actualizado.clienteId,
            equipoId: actualizado.equipoId,
            fecha_ultimo_servicio: new Date(),
            fecha_proximo_recordatorio: proximaFecha,
          },
        });
      } catch (err) {
        console.error('[Recordatorio] Error creando recordatorio:', err.message);
      }
    }

    res.json({ success: true, data: actualizado });
  } catch (error) {
    next(error);
  }
};

const asignarTecnico = async (req, res, next) => {
  try {
    const { tecnico_id } = req.body;

    const tecnico = await prisma.usuario.findUnique({ where: { id: tecnico_id } });
    if (!tecnico || !tecnico.activo || tecnico.rol !== 'tecnico') {
      return res.status(400).json({ success: false, error: 'Técnico no válido', code: 'INVALID_TECNICO' });
    }

    const servicio = await prisma.servicio.update({
      where: { id: req.params.id },
      data: { tecnicoId: tecnico_id, estado: 'asignado' },
      include: {
        cliente: true,
        tecnico: { select: { id: true, nombre: true } },
        equipo: true,
      },
    });

    await prisma.eventoServicio.create({
      data: {
        servicioId: req.params.id,
        tipo: 'asignado',
        descripcion: `Servicio asignado a ${tecnico.nombre}`,
        usuarioId: req.usuario.id,
      },
    });

    if (tecnico.telefono) {
      const { enviarMensaje } = require('../whatsapp/bot');
      const cliente = servicio.cliente?.nombre || 'Cliente';
      const equipo = servicio.equipo
        ? `${servicio.equipo.tipo === 'aire_acondicionado' ? 'aire acondicionado' : servicio.equipo.tipo === 'nevera' ? 'nevera' : 'equipo'} ${servicio.equipo.marca || ''}`.trim()
        : 'equipo';
      const fecha = servicio.fecha_programada ? new Date(servicio.fecha_programada).toLocaleDateString('es-CO') : 'Por definir';
      const hora = servicio.hora_inicio || 'Por definir';
      const msg = `🔧 *RefriElectri Pro — Nuevo Servicio Asignado*\n\n👤 Cliente: *${cliente}*\n🏠 Dirección: ${servicio.direccion_servicio || 'Por definir'}\n📅 Fecha: ${fecha}\n🕐 Hora: ${hora}\n🔌 Equipo: ${equipo}\n⚠️ Falla: ${servicio.descripcion_falla || 'No especificada'}\n\nRevisa tu app para más detalles.`;
      try { await enviarMensaje(tecnico.telefono, msg); } catch (err) { console.error('[WhatsApp] Error notificando técnico:', err.message); }
    }

    try { getIO().to('admin').emit('servicio_actualizado', servicio); } catch (_) {}

    res.json({ success: true, data: servicio });
  } catch (error) {
    next(error);
  }
};

const obtenerChecklist = async (req, res, next) => {
  try {
    const items = await prisma.checklistItem.findMany({
      where: { servicioId: req.params.id },
      include: { completado_por: { select: { id: true, nombre: true } } },
      orderBy: { orden: 'asc' },
    });
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
};

const marcarChecklist = async (req, res, next) => {
  try {
    const item = await prisma.checklistItem.update({
      where: { id: req.params.item_id },
      data: {
        completado: true,
        completado_at: new Date(),
        completado_por_id: req.usuario.id,
      },
    });

    await prisma.eventoServicio.create({
      data: {
        servicioId: req.params.id,
        tipo: 'checklist_item',
        descripcion: `Checklist completado: ${item.descripcion}`,
        usuarioId: req.usuario.id,
      },
    });

    try { getIO().to(`servicio_${req.params.id}`).emit('checklist_actualizado', item); } catch (_) {}

    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

const subirFoto = async (req, res, next) => {
  try {
    const { tipo } = req.body;
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se envió ninguna foto', code: 'NO_FILE' });
    }

    const fotosExistentes = await prisma.fotoServicio.count({ where: { servicioId: req.params.id } });
    if (fotosExistentes >= 4) {
      return res.status(400).json({ success: false, error: 'Máximo 4 fotos por servicio', code: 'MAX_FOTOS' });
    }

    const result = await uploadToCloudinary(req.file.buffer, `techserv/servicios/${req.params.id}`);

    const foto = await prisma.fotoServicio.create({
      data: {
        servicioId: req.params.id,
        url: result.secure_url,
        tipo: tipo || 'durante',
      },
    });

    await prisma.eventoServicio.create({
      data: {
        servicioId: req.params.id,
        tipo: 'foto_subida',
        descripcion: `Foto "${tipo || 'durante'}" subida`,
        usuarioId: req.usuario.id,
      },
    });

    res.status(201).json({ success: true, data: foto });
  } catch (error) {
    next(error);
  }
};

const guardarFirma = async (req, res, next) => {
  try {
    const { firma_base64 } = req.body;
    if (!firma_base64) {
      return res.status(400).json({ success: false, error: 'La firma es requerida', code: 'NO_FIRMA' });
    }

    const result = await uploadBase64ToCloudinary(firma_base64, `techserv/firmas/${req.params.id}`);

    const firma = await prisma.firmaCliente.upsert({
      where: { servicioId: req.params.id },
      update: { url: result.secure_url, firmado_at: new Date() },
      create: { servicioId: req.params.id, url: result.secure_url },
    });

    res.status(201).json({ success: true, data: firma });
  } catch (error) {
    next(error);
  }
};

const guardarCalificacion = async (req, res, next) => {
  try {
    const { calificacion } = req.body;
    if (!calificacion || calificacion < 1 || calificacion > 5) {
      return res.status(400).json({ success: false, error: 'Calificación debe ser entre 1 y 5', code: 'VALIDATION_ERROR' });
    }

    const servicio = await prisma.servicio.update({
      where: { id: req.params.id },
      data: { calificacion_cliente: calificacion },
    });

    res.json({ success: true, data: servicio });
  } catch (error) {
    next(error);
  }
};

const agregarNota = async (req, res, next) => {
  try {
    const { contenido } = req.body;
    if (!contenido) {
      return res.status(400).json({ success: false, error: 'El contenido es requerido', code: 'VALIDATION_ERROR' });
    }

    const evento = await prisma.eventoServicio.create({
      data: {
        servicioId: req.params.id,
        tipo: 'nota',
        descripcion: contenido,
        usuarioId: req.usuario.id,
      },
      include: { usuario: { select: { id: true, nombre: true } } },
    });

    try { getIO().to(`servicio_${req.params.id}`).emit('nuevo_evento', evento); } catch (_) {}

    res.status(201).json({ success: true, data: evento });
  } catch (error) {
    next(error);
  }
};

const historialEquipo = async (req, res, next) => {
  try {
    const { equipo_id } = req.params;
    const { excluir_servicio } = req.query;

    const where = { equipoId: equipo_id, estado: 'completado' };
    if (excluir_servicio) where.id = { not: excluir_servicio };

    const servicios = await prisma.servicio.findMany({
      where,
      select: {
        id: true,
        descripcion_falla: true,
        notas_tecnico: true,
        fecha_programada: true,
        fecha_fin_real: true,
        valor_final: true,
        calificacion_cliente: true,
        tecnico: { select: { id: true, nombre: true } },
      },
      orderBy: { fecha_programada: 'desc' },
      take: 5,
    });

    const total = await prisma.servicio.count({
      where: { equipoId: equipo_id, estado: 'completado' },
    });

    res.json({ success: true, data: { servicios, total } });
  } catch (error) {
    next(error);
  }
};

const eliminar = async (req, res, next) => {
  try {
    const servicio = await prisma.servicio.findUnique({ where: { id: req.params.id } });
    if (!servicio) {
      return res.status(404).json({ success: false, error: 'Servicio no encontrado', code: 'NOT_FOUND' });
    }
    await prisma.servicio.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Servicio eliminado' });
  } catch (error) {
    next(error);
  }
};

const corregirEquipo = async (req, res, next) => {
  try {
    const servicio = await prisma.servicio.findUnique({
      where: { id: req.params.id },
      include: { equipo: true },
    });
    if (!servicio) return res.status(404).json({ success: false, error: 'Servicio no encontrado' });
    if (!servicio.equipoId) return res.status(400).json({ success: false, error: 'Servicio sin equipo asociado' });

    const esTecnicoAsignado = servicio.tecnicoId === req.usuario.id;
    const esAdmin = req.usuario.rol === 'admin';
    if (!esAdmin && !esTecnicoAsignado) {
      return res.status(403).json({ success: false, error: 'No tienes permiso' });
    }

    const { marca, modelo, serial, capacidad } = req.body;
    const data = {};
    if (marca !== undefined) data.marca = marca;
    if (modelo !== undefined) data.modelo = modelo;
    if (serial !== undefined) data.serial = serial;
    if (capacidad !== undefined) data.notas = capacidad;

    const equipo = await prisma.equipo.update({
      where: { id: servicio.equipoId },
      data,
    });

    try { getIO().to('admin').emit('equipo_corregido', { servicioId: servicio.id, equipo }); } catch (_) {}

    res.json({ success: true, data: equipo });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listar, obtener, crear, actualizar, cambiarEstado, asignarTecnico,
  obtenerChecklist, marcarChecklist, subirFoto, guardarFirma,
  guardarCalificacion, agregarNota, historialEquipo, eliminar, corregirEquipo,
};
