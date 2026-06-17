const prisma = require('../config/db');

const listar = async (req, res, next) => {
  try {
    const catalogos = await prisma.catalogoServicio.findMany({
      include: { items: { orderBy: { orden: 'asc' } } },
      orderBy: { nombre: 'asc' },
    });
    res.json({ success: true, data: catalogos });
  } catch (error) { next(error); }
};

const obtener = async (req, res, next) => {
  try {
    const catalogo = await prisma.catalogoServicio.findUnique({
      where: { id: req.params.id },
      include: { items: { orderBy: { orden: 'asc' } } },
    });
    if (!catalogo) return res.status(404).json({ success: false, error: 'Servicio no encontrado' });
    res.json({ success: true, data: catalogo });
  } catch (error) { next(error); }
};

const crear = async (req, res, next) => {
  try {
    const { nombre, descripcion, clave, duracion_min, items } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ success: false, error: 'El nombre es requerido' });

    const catalogo = await prisma.catalogoServicio.create({
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion || null,
        clave: clave?.trim() || null,
        duracion_min: duracion_min ? parseInt(duracion_min) : 60,
        items: items?.length
          ? { create: items.map((it, i) => ({ categoria: it.categoria, descripcion: it.descripcion, orden: i + 1 })) }
          : undefined,
      },
      include: { items: { orderBy: { orden: 'asc' } } },
    });
    res.status(201).json({ success: true, data: catalogo });
  } catch (error) { next(error); }
};

const actualizar = async (req, res, next) => {
  try {
    const { nombre, descripcion, clave, duracion_min, activo } = req.body;
    const data = {};
    if (nombre !== undefined) data.nombre = nombre.trim();
    if (descripcion !== undefined) data.descripcion = descripcion || null;
    if (clave !== undefined) data.clave = clave?.trim() || null;
    if (duracion_min !== undefined) data.duracion_min = parseInt(duracion_min);
    if (activo !== undefined) data.activo = activo;

    const catalogo = await prisma.catalogoServicio.update({
      where: { id: req.params.id },
      data,
      include: { items: { orderBy: { orden: 'asc' } } },
    });
    res.json({ success: true, data: catalogo });
  } catch (error) { next(error); }
};

const eliminar = async (req, res, next) => {
  try {
    await prisma.catalogoServicio.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) { next(error); }
};

// Items del checklist
const agregarItem = async (req, res, next) => {
  try {
    const { categoria, descripcion } = req.body;
    if (!descripcion?.trim()) return res.status(400).json({ success: false, error: 'La descripción es requerida' });

    const count = await prisma.catalogoChecklistItem.count({ where: { catalogoId: req.params.id } });
    const item = await prisma.catalogoChecklistItem.create({
      data: {
        catalogoId: req.params.id,
        categoria: categoria || 'diagnostico',
        descripcion: descripcion.trim(),
        orden: count + 1,
      },
    });
    res.status(201).json({ success: true, data: item });
  } catch (error) { next(error); }
};

const actualizarItem = async (req, res, next) => {
  try {
    const { categoria, descripcion, orden } = req.body;
    const data = {};
    if (categoria !== undefined) data.categoria = categoria;
    if (descripcion !== undefined) data.descripcion = descripcion.trim();
    if (orden !== undefined) data.orden = parseInt(orden);

    const item = await prisma.catalogoChecklistItem.update({
      where: { id: req.params.itemId },
      data,
    });
    res.json({ success: true, data: item });
  } catch (error) { next(error); }
};

const eliminarItem = async (req, res, next) => {
  try {
    await prisma.catalogoChecklistItem.delete({ where: { id: req.params.itemId } });
    res.json({ success: true });
  } catch (error) { next(error); }
};

// Reemplazar todos los items de un catalogo (usado al guardar el editor completo)
const reemplazarItems = async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ success: false, error: 'items debe ser un array' });

    await prisma.catalogoChecklistItem.deleteMany({ where: { catalogoId: req.params.id } });
    if (items.length > 0) {
      await prisma.catalogoChecklistItem.createMany({
        data: items.map((it, i) => ({
          catalogoId: req.params.id,
          categoria: it.categoria || 'diagnostico',
          descripcion: it.descripcion,
          orden: i + 1,
        })),
      });
    }
    const catalogo = await prisma.catalogoServicio.findUnique({
      where: { id: req.params.id },
      include: { items: { orderBy: { orden: 'asc' } } },
    });
    res.json({ success: true, data: catalogo });
  } catch (error) { next(error); }
};

module.exports = { listar, obtener, crear, actualizar, eliminar, agregarItem, actualizarItem, eliminarItem, reemplazarItems };
