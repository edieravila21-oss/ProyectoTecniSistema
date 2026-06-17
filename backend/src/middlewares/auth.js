const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Token requerido', code: 'NO_TOKEN' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await prisma.usuario.findUnique({
      where: { id: decoded.id },
      select: { id: true, nombre: true, email: true, rol: true, activo: true, especialidad: true, telefono: true },
    });
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ success: false, error: 'Usuario no encontrado o inactivo', code: 'USER_NOT_FOUND' });
    }
    req.usuario = usuario;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Token inválido o expirado', code: 'INVALID_TOKEN' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.usuario?.rol !== 'admin') {
    return res.status(403).json({ success: false, error: 'Acceso solo para administradores', code: 'FORBIDDEN' });
  }
  next();
};

const requireTecnico = (req, res, next) => {
  if (!['admin', 'tecnico'].includes(req.usuario?.rol)) {
    return res.status(403).json({ success: false, error: 'Acceso no autorizado', code: 'FORBIDDEN' });
  }
  next();
};

module.exports = { verifyToken, requireAdmin, requireTecnico };

