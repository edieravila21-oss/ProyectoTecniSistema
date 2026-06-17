const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { enviarEmail } = require('../config/mailer');
const { v4: uuidv4 } = require('uuid');

const login = async (req, res, next) => {
  try {
    const { email, pin } = req.body;
    if (!email || !pin) {
      return res.status(400).json({ success: false, error: 'Email y PIN son requeridos', code: 'VALIDATION_ERROR' });
    }

    const pinStr = String(pin).trim();
    if (!/^\d{4,6}$/.test(pinStr)) {
      return res.status(400).json({ success: false, error: 'El PIN debe ser un código numérico de 4 a 6 dígitos', code: 'VALIDATION_ERROR' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas', code: 'INVALID_CREDENTIALS' });
    }

    const pinValido = await bcrypt.compare(pinStr, usuario.password);
    if (!pinValido) {
      return res.status(401).json({ success: false, error: 'PIN inválido', code: 'INVALID_CREDENTIALS' });
    }

    const token = jwt.sign(
      { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      success: true,
      data: {
        token,
        usuario: {
          id: usuario.id,
          nombre: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol,
          foto_url: usuario.foto_url,
          especialidad: usuario.especialidad,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const me = async (req, res, next) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario.id },
      select: { id: true, nombre: true, email: true, rol: true, telefono: true, foto_url: true, especialidad: true, activo: true },
    });

    if (!usuario) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado', code: 'NOT_FOUND' });
    }

    res.json({ success: true, data: usuario });
  } catch (error) {
    next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const { id, nombre, rol } = req.usuario;
    const token = jwt.sign({ id, nombre, rol }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
    res.json({ success: true, data: { token } });
  } catch (error) {
    next(error);
  }
};

const resetTokens = new Map();

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const usuario = await prisma.usuario.findUnique({ where: { email } });

    if (usuario) {
      const token = uuidv4();
      resetTokens.set(token, { userId: usuario.id, expiresAt: Date.now() + 3600000 });

      await enviarEmail({
        to: email,
        subject: 'Recuperar PIN - RefriElectri Pro',
        html: `<p>Hola ${usuario.nombre},</p>
        <p>Usa este enlace para restablecer tu PIN de acceso (válido por 1 hora):</p>
        <p><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}">Restablecer PIN</a></p>
        <p>Si no solicitaste este cambio, ignora este correo.</p>`,
      });
    }

    res.json({ success: true, data: { message: 'Si el correo existe, recibirás un enlace de recuperación' } });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, nuevo_pin } = req.body;
    const resetData = resetTokens.get(token);

    if (!resetData || resetData.expiresAt < Date.now()) {
      return res.status(400).json({ success: false, error: 'Token inválido o expirado', code: 'INVALID_TOKEN' });
    }

    const pinStr = String(nuevo_pin).trim();
    if (!/^\d{4,6}$/.test(pinStr)) {
      return res.status(400).json({ success: false, error: 'El PIN debe ser un código numérico de 4 a 6 dígitos', code: 'VALIDATION_ERROR' });
    }

    const hashedPin = await bcrypt.hash(pinStr, 10);
    await prisma.usuario.update({ where: { id: resetData.userId }, data: { password: hashedPin } });
    resetTokens.delete(token);

    res.json({ success: true, data: { message: 'PIN actualizado correctamente' } });
  } catch (error) {
    next(error);
  }
};

const cambiarPin = async (req, res, next) => {
  try {
    const { pin_actual, pin_nuevo } = req.body;
    const usuarioId = req.usuario.id;

    if (!pin_actual || !pin_nuevo) {
      return res.status(400).json({ success: false, error: 'PIN actual y nuevo PIN son requeridos', code: 'VALIDATION_ERROR' });
    }

    const pinNuevoStr = String(pin_nuevo).trim();
    if (!/^\d{4,6}$/.test(pinNuevoStr)) {
      return res.status(400).json({ success: false, error: 'El nuevo PIN debe ser un código numérico de 4 a 6 dígitos', code: 'VALIDATION_ERROR' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado', code: 'NOT_FOUND' });
    }

    const pinActualValido = await bcrypt.compare(String(pin_actual).trim(), usuario.password);
    if (!pinActualValido) {
      return res.status(401).json({ success: false, error: 'PIN actual incorrecto', code: 'INVALID_PIN' });
    }

    const hashedPin = await bcrypt.hash(pinNuevoStr, 10);
    await prisma.usuario.update({ where: { id: usuarioId }, data: { password: hashedPin } });

    res.json({ success: true, data: { message: 'PIN actualizado correctamente' } });
  } catch (error) {
    next(error);
  }
};

const verificarEmail = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email es requerido' });
    const usuario = await prisma.usuario.findUnique({ where: { email }, select: { id: true, nombre: true, activo: true } });
    if (!usuario || !usuario.activo) {
      return res.status(404).json({ success: false, error: 'No se encontró una cuenta con ese correo' });
    }
    res.json({ success: true, data: { nombre: usuario.nombre } });
  } catch (error) {
    next(error);
  }
};

// Login para técnicos: solo PIN, sin correo
// Compara el PIN contra todos los técnicos activos hasta encontrar coincidencia única
const loginConPin = async (req, res, next) => {
  try {
    const { pin } = req.body;
    if (!pin) {
      return res.status(400).json({ success: false, error: 'PIN es requerido', code: 'VALIDATION_ERROR' });
    }

    const pinStr = String(pin).trim();
    if (!/^\d{4}$/.test(pinStr)) {
      return res.status(400).json({ success: false, error: 'El PIN debe ser de 4 dígitos', code: 'VALIDATION_ERROR' });
    }

    const tecnicos = await prisma.usuario.findMany({
      where: { rol: 'tecnico', activo: true },
    });

    let coincidencia = null;
    for (const t of tecnicos) {
      const valido = await bcrypt.compare(pinStr, t.password);
      if (valido) {
        coincidencia = t;
        break;
      }
    }

    if (!coincidencia) {
      return res.status(401).json({ success: false, error: 'PIN incorrecto', code: 'INVALID_CREDENTIALS' });
    }

    const token = jwt.sign(
      { id: coincidencia.id, nombre: coincidencia.nombre, rol: coincidencia.rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      success: true,
      data: {
        token,
        usuario: {
          id: coincidencia.id,
          nombre: coincidencia.nombre,
          email: coincidencia.email,
          rol: coincidencia.rol,
          foto_url: coincidencia.foto_url,
          especialidad: coincidencia.especialidad,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { login, loginConPin, me, refresh, forgotPassword, resetPassword, cambiarPin, verificarEmail };
