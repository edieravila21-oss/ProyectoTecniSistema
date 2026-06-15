const prisma = require('../config/db');

const hoy = async (req, res, next) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const whereHoy = { fecha_programada: { gte: startOfDay, lte: endOfDay } };

    const [serviciosHoy, completados, pendientes, enCurso, tecnicos, mensajes] = await Promise.all([
      prisma.servicio.count({ where: whereHoy }),
      prisma.servicio.count({ where: { ...whereHoy, estado: 'completado' } }),
      prisma.servicio.count({ where: { ...whereHoy, estado: 'pendiente' } }),
      prisma.servicio.count({ where: { ...whereHoy, estado: { in: ['en_camino', 'en_servicio'] } } }),
      prisma.usuario.findMany({
        where: { rol: 'tecnico', activo: true },
        select: {
          id: true, nombre: true, foto_url: true,
          servicios: {
            where: whereHoy,
            select: { id: true, estado: true, direccion_servicio: true, fecha_inicio_real: true, cliente: { select: { nombre: true } } },
            orderBy: { hora_inicio: 'asc' },
          },
        },
      }),
      prisma.mensajeWhatsApp.count({
        where: { createdAt: { gte: startOfDay, lte: endOfDay }, direccion: 'entrante' },
      }),
    ]);

    const ingresos = await prisma.servicio.aggregate({
      where: { ...whereHoy, estado: 'completado' },
      _sum: { valor_final: true },
    });

    const tecnicosData = tecnicos.map((t) => {
      const servicioActivo = t.servicios.find((s) => ['en_camino', 'en_servicio'].includes(s.estado));
      return {
        id: t.id,
        nombre: t.nombre,
        foto_url: t.foto_url,
        estado: servicioActivo ? servicioActivo.estado : 'disponible',
        servicios_hoy: t.servicios.length,
        servicio_activo: servicioActivo || null,
      };
    });

    res.json({
      success: true,
      data: {
        servicios_hoy: serviciosHoy,
        completados,
        pendientes,
        en_curso: enCurso,
        ingresos_hoy: ingresos._sum.valor_final || 0,
        mensajes_whatsapp: mensajes,
        tecnicos_activos: tecnicosData,
      },
    });
  } catch (error) {
    next(error);
  }
};

const resumen = async (req, res, next) => {
  try {
    const { desde, hasta, tecnicoId } = req.query;
    const where = {};
    if (desde && hasta) {
      where.fecha_programada = { gte: new Date(desde), lte: new Date(hasta) };
    }
    if (tecnicoId) {
      where.tecnicoId = tecnicoId;
    }

    const [total, completados, cancelados] = await Promise.all([
      prisma.servicio.count({ where }),
      prisma.servicio.count({ where: { ...where, estado: 'completado' } }),
      prisma.servicio.count({ where: { ...where, estado: 'cancelado' } }),
    ]);

    const stats = await prisma.servicio.aggregate({
      where: { ...where, estado: 'completado' },
      _sum: { valor_final: true },
      _avg: { calificacion_cliente: true, valor_final: true },
    });

    const serviciosPorDia = await prisma.servicio.groupBy({
      by: ['fecha_programada'],
      where,
      _count: true,
      orderBy: { fecha_programada: 'asc' },
    });

    res.json({
      success: true,
      data: {
        total_servicios: total,
        completados,
        cancelados,
        ingresos_totales: stats._sum.valor_final || 0,
        calificacion_promedio: stats._avg.calificacion_cliente || 0,
        valor_promedio: stats._avg.valor_final || 0,
        servicios_por_dia: serviciosPorDia.map((s) => ({
          fecha: s.fecha_programada,
          total: s._count,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

const porTecnicos = async (req, res, next) => {
  try {
    const { desde, hasta } = req.query;
    const whereDate = {};
    if (desde && hasta) {
      whereDate.fecha_programada = { gte: new Date(desde), lte: new Date(hasta) };
    }

    const tecnicos = await prisma.usuario.findMany({
      where: { rol: 'tecnico' },
      select: { id: true, nombre: true, foto_url: true, activo: true },
    });

    const data = await Promise.all(
      tecnicos.map(async (t) => {
        const where = { tecnicoId: t.id, ...whereDate };
        const [total, completados] = await Promise.all([
          prisma.servicio.count({ where }),
          prisma.servicio.count({ where: { ...where, estado: 'completado' } }),
        ]);
        const stats = await prisma.servicio.aggregate({
          where: { ...where, estado: 'completado' },
          _avg: { calificacion_cliente: true },
          _sum: { valor_final: true },
        });

        return {
          id: t.id,
          nombre: t.nombre,
          foto_url: t.foto_url,
          activo: t.activo,
          servicios: total,
          completados,
          ingresos_generados: stats._sum.valor_final || 0,
          calificacion_promedio: stats._avg.calificacion_cliente || 0,
        };
      })
    );

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const porEquipos = async (req, res, next) => {
  try {
    const { desde, hasta, tecnicoId } = req.query;
    const where = {};
    if (desde && hasta) {
      where.fecha_programada = { gte: new Date(desde), lte: new Date(hasta) };
    }
    if (tecnicoId) {
      where.tecnicoId = tecnicoId;
    }

    const porTipo = await prisma.servicio.groupBy({
      by: ['equipoId'],
      where,
      _count: true,
    });

    const equipos = await prisma.equipo.findMany({
      where: { id: { in: porTipo.map((p) => p.equipoId).filter(Boolean) } },
    });

    const tipoCount = {};
    const marcaCount = {};
    equipos.forEach((e) => {
      tipoCount[e.tipo] = (tipoCount[e.tipo] || 0) + (porTipo.find((p) => p.equipoId === e.id)?._count || 0);
      if (e.marca) marcaCount[e.marca] = (marcaCount[e.marca] || 0) + (porTipo.find((p) => p.equipoId === e.id)?._count || 0);
    });

    res.json({
      success: true,
      data: {
        por_tipo: Object.entries(tipoCount).map(([tipo, count]) => ({ tipo, count })),
        por_marca: Object.entries(marcaCount).map(([marca, count]) => ({ marca, count })).sort((a, b) => b.count - a.count).slice(0, 5),
      },
    });
  } catch (error) {
    next(error);
  }
};

const canales = async (req, res, next) => {
  try {
    const { desde, hasta, tecnicoId } = req.query;
    const where = {};
    if (desde && hasta) {
      where.createdAt = { gte: new Date(desde), lte: new Date(hasta) };
    }
    if (tecnicoId) {
      where.tecnicoId = tecnicoId;
    }

    const [whatsapp, manual] = await Promise.all([
      prisma.servicio.count({ where: { ...where, origen: 'whatsapp' } }),
      prisma.servicio.count({ where: { ...where, origen: 'manual' } }),
    ]);

    res.json({
      success: true,
      data: {
        por_origen: { whatsapp, manual },
      },
    });
  } catch (error) {
    next(error);
  }
};

const sla = async (req, res, next) => {
  try {
    const { desde, hasta, tecnicoId } = req.query;
    const whereDate = {};
    if (desde && hasta) {
      whereDate.fecha_programada = { gte: new Date(desde), lte: new Date(hasta) };
    }
    if (tecnicoId) {
      whereDate.tecnicoId = tecnicoId;
    }

    // Cargar configuraciones de SLA
    const configSLA = await prisma.configuracionSLA.findMany();
    const slaMap = {};
    configSLA.forEach(config => {
      slaMap[config.tipo_servicio] = config;
    });

    const completados = await prisma.servicio.findMany({
      where: { ...whereDate, estado: 'completado' },
      select: {
        id: true,
        tipo_servicio: true,
        fecha_programada: true,
        fecha_en_camino: true,
        fecha_inicio_real: true,
        fecha_fin_real: true,
        calificacion_cliente: true,
        createdAt: true,
      },
    });

    // SLA 1: Tiempo en camino (desde en_camino hasta inicio real)
    const tiemposEnCaminoReal = completados
      .filter(s => s.fecha_en_camino && s.fecha_inicio_real)
      .map(s => {
        const tiempoMinutos = (new Date(s.fecha_inicio_real).getTime() - new Date(s.fecha_en_camino).getTime()) / 60000;
        const maxCamino = slaMap[s.tipo_servicio]?.max_tiempo_camino_min ?? 15;
        return {
          servicioId: s.id,
          tiempoMinutos,
          tipo_servicio: s.tipo_servicio,
          max_tiempo_camino_min: maxCamino,
          cumple_sla: tiempoMinutos <= maxCamino,
        };
      });
    
    const tiempoEnCaminoPromedio = tiemposEnCaminoReal.length
      ? tiemposEnCaminoReal.reduce((a, b) => a + b.tiempoMinutos, 0) / tiemposEnCaminoReal.length
      : 0;
    
    const slaEnCaminoCumplido = tiemposEnCaminoReal.length
      ? (tiemposEnCaminoReal.filter(t => t.cumple_sla).length / tiemposEnCaminoReal.length) * 100
      : 0;

    // SLA 2: Tiempo de ejecución (desde inicio real hasta fin real)
    const tiemposEjecucion = completados
      .filter(s => s.fecha_inicio_real && s.fecha_fin_real)
      .map(s => {
        const tiempoMinutos = (new Date(s.fecha_fin_real).getTime() - new Date(s.fecha_inicio_real).getTime()) / 60000;
        const config = slaMap[s.tipo_servicio];
        const maxTiempo = config ? config.max_tiempo_ejecucion_min : 120;
        return {
          servicioId: s.id,
          tiempoMinutos,
          tipo_servicio: s.tipo_servicio,
          max_tiempo_min: maxTiempo,
          cumple_sla: tiempoMinutos <= maxTiempo,
        };
      });
    
    const tiempoEjecucionPromedio = tiemposEjecucion.length
      ? tiemposEjecucion.reduce((a, b) => a + b.tiempoMinutos, 0) / tiemposEjecucion.length
      : 0;
    
    const slaEjecucionCumplido = tiemposEjecucion.length
      ? (tiemposEjecucion.filter(t => t.cumple_sla).length / tiemposEjecucion.length) * 100
      : 0;

    // Tiempo promedio de respuesta: creación → inicio real
    const tiemposRespuesta = completados
      .filter(s => s.fecha_inicio_real && s.createdAt)
      .map(s => (new Date(s.fecha_inicio_real).getTime() - new Date(s.createdAt).getTime()) / 60000);
    const tiempoRespuestaPromedio = tiemposRespuesta.length
      ? tiemposRespuesta.reduce((a, b) => a + b, 0) / tiemposRespuesta.length
      : 0;

    // Tiempo promedio de servicio: inicio real → fin real
    const tiemposServicio = completados
      .filter(s => s.fecha_inicio_real && s.fecha_fin_real)
      .map(s => (new Date(s.fecha_fin_real).getTime() - new Date(s.fecha_inicio_real).getTime()) / 60000);
    const tiempoServicioPromedio = tiemposServicio.length
      ? tiemposServicio.reduce((a, b) => a + b, 0) / tiemposServicio.length
      : 0;

    // Tiempo promedio desde programada → inicio real
    const tiemposDesdeProgUntilInicio = completados
      .filter(s => s.fecha_inicio_real && s.fecha_programada)
      .map(s => (new Date(s.fecha_inicio_real).getTime() - new Date(s.fecha_programada).getTime()) / 60000)
      .filter(t => t >= 0 && t < 24 * 60);
    const tiempoDesdeProgPromedioMin = tiemposDesdeProgUntilInicio.length
      ? tiemposDesdeProgUntilInicio.reduce((a, b) => a + b, 0) / tiemposDesdeProgUntilInicio.length
      : 0;

    // Tasa de completados vs total
    const totalServicios = await prisma.servicio.count({ where: whereDate });
    const totalCompletados = completados.length;
    const totalCancelados = await prisma.servicio.count({ where: { ...whereDate, estado: 'cancelado' } });
    const tasaCompletado = totalServicios > 0 ? (totalCompletados / totalServicios) * 100 : 0;

    // Servicios en curso actualmente
    const enCursoAhora = await prisma.servicio.count({
      where: { ...(tecnicoId ? { tecnicoId } : {}), estado: { in: ['en_camino', 'en_servicio'] } },
    });

    // Checklist: usar servicioIds para evitar el filtro anidado inválido
    const servicioIds = completados.map(s => s.id);
    let checklistTotal = 0;
    let checklistDone = 0;
    if (servicioIds.length > 0) {
      const [all, done] = await Promise.all([
        prisma.checklistItem.count({ where: { servicioId: { in: servicioIds } } }),
        prisma.checklistItem.count({ where: { servicioId: { in: servicioIds }, completado: true } }),
      ]);
      checklistTotal = all;
      checklistDone = done;
    }
    const checklistRate = checklistTotal > 0 ? (checklistDone / checklistTotal) * 100 : 0;

    // Fotos y firmas — procesos que el técnico ejecuta durante el servicio
    let fotosAntes = 0;
    let fotosDespues = 0;
    let firmasTotales = 0;
    if (servicioIds.length > 0) {
      const [fa, fd, firma] = await Promise.all([
        prisma.fotoServicio.count({ where: { servicioId: { in: servicioIds }, tipo: 'antes' } }),
        prisma.fotoServicio.count({ where: { servicioId: { in: servicioIds }, tipo: 'despues' } }),
        prisma.firmaCliente.count({ where: { servicioId: { in: servicioIds } } }),
      ]);
      fotosAntes = fa;
      fotosDespues = fd;
      firmasTotales = firma;
    }
    // % de servicios completados que tienen foto después (obligatoria)
    const tasaFotos = totalCompletados > 0 ? Math.round((fotosDespues / totalCompletados) * 100) : 0;
    // % de servicios completados que tienen firma del cliente
    const tasaFirmas = totalCompletados > 0 ? Math.round((firmasTotales / totalCompletados) * 100) : 0;

    // Rating distribution
    const calificaciones = completados
      .filter(s => s.calificacion_cliente)
      .map(s => s.calificacion_cliente);
    const ratingDistribucion = [1, 2, 3, 4, 5].map(n => ({
      estrellas: n,
      cantidad: calificaciones.filter(c => c === n).length,
    }));
    const ratingPromedio = calificaciones.length
      ? calificaciones.reduce((a, b) => a + b, 0) / calificaciones.length : 0;

    // Servicios por día de la semana
    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const porDiaSemana = diasSemana.map((dia, i) => ({
      dia,
      cantidad: completados.filter(s => s.fecha_programada && new Date(s.fecha_programada).getDay() === i).length,
    }));

    // Clientes únicos atendidos
    const clientesUnicos = await prisma.servicio.groupBy({
      by: ['clienteId'],
      where: { ...whereDate, estado: 'completado' },
    });

    // Clientes recurrentes (más de 1 servicio completado en el periodo)
    const clientesRecurrentes = await prisma.servicio.groupBy({
      by: ['clienteId'],
      where: { ...whereDate, estado: 'completado' },
      having: { clienteId: { _count: { gt: 1 } } },
    });
    const tasaRetencion = clientesUnicos.length > 0
      ? (clientesRecurrentes.length / clientesUnicos.length) * 100 : 0;

    // Servicios que no cumplen SLAs
    const serviciosFueraDelSLA = [
      ...tiemposEnCaminoReal.filter(t => !t.cumple_sla),
      ...tiemposEjecucion.filter(t => !t.cumple_sla),
    ].map(s => s.servicioId);

    res.json({
      success: true,
      data: {
        // === NUEVOS SLAs PRINCIPALES ===
        sla_en_camino: {
          tiempo_promedio_minutos: Math.round(tiempoEnCaminoPromedio * 10) / 10,
          max_permitido_minutos: configSLA.length > 0 ? configSLA[0].max_tiempo_camino_min : 15,
          tasa_cumplimiento: Math.round(slaEnCaminoCumplido * 10) / 10,
          servicios_evaluados: tiemposEnCaminoReal.length,
          servicios_dentro_sla: tiemposEnCaminoReal.filter(t => t.cumple_sla).length,
          detalle_por_tipo: configSLA.map(config => ({
            tipo_servicio: config.tipo_servicio,
            max_tiempo_camino_min: config.max_tiempo_camino_min,
            servicios_de_este_tipo: tiemposEnCaminoReal.filter(t => t.tipo_servicio === config.tipo_servicio).length,
            dentro_sla: tiemposEnCaminoReal.filter(t => t.tipo_servicio === config.tipo_servicio && t.cumple_sla).length,
          })),
        },
        sla_ejecucion: {
          tiempo_promedio_minutos: Math.round(tiempoEjecucionPromedio * 10) / 10,
          tasa_cumplimiento: Math.round(slaEjecucionCumplido * 10) / 10,
          servicios_evaluados: tiemposEjecucion.length,
          servicios_dentro_sla: tiemposEjecucion.filter(t => t.cumple_sla).length,
          detalle_por_tipo: configSLA.map(config => ({
            tipo_servicio: config.tipo_servicio,
            max_tiempo_min: config.max_tiempo_ejecucion_min,
            servicios_de_este_tipo: tiemposEjecucion.filter(t => t.tipo_servicio === config.tipo_servicio).length,
          })),
        },
        // Tiempos de ejecución del técnico
        tiempo_respuesta_promedio: Math.round(tiempoRespuestaPromedio),
        tiempo_servicio_promedio: Math.round(tiempoServicioPromedio),
        tiempo_en_camino_promedio: Math.round(tiempoDesdeProgPromedioMin),
        // Tasas de calidad
        tasa_completado: Math.round(tasaCompletado * 10) / 10,
        tasa_cancelacion: totalServicios > 0 ? Math.round((totalCancelados / totalServicios) * 1000) / 10 : 0,
        // Checklist (proceso técnico)
        checklist_completion: Math.round(checklistRate * 10) / 10,
        checklist_total: checklistTotal,
        checklist_done: checklistDone,
        // Documentación (proceso técnico: fotos y firma)
        tasa_fotos: tasaFotos,
        tasa_firmas: tasaFirmas,
        fotos_antes: fotosAntes,
        fotos_despues: fotosDespues,
        firmas_totales: firmasTotales,
        // Rating
        rating_promedio: Math.round(ratingPromedio * 10) / 10,
        rating_distribucion: ratingDistribucion,
        // Totales
        total_servicios: totalServicios,
        total_completados: totalCompletados,
        total_cancelados: totalCancelados,
        en_curso_ahora: enCursoAhora,
        // Clientes
        clientes_unicos: clientesUnicos.length,
        tasa_retencion: Math.round(tasaRetencion * 10) / 10,
        // Distribución
        por_dia_semana: porDiaSemana,
        // Servicios problemáticos
        servicios_fuera_del_sla: serviciosFueraDelSLA,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { hoy, resumen, porTecnicos, porEquipos, canales, sla };
