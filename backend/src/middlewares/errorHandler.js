const errorHandler = (err, req, res, _next) => {
  console.error(`[Error] ${req.method} ${req.path} →`, err.message, err.stack?.split('\n')[1]?.trim() || '');

  if (err.name === 'ValidationError' || err.message?.includes('Validation')) {
    return res.status(400).json({
      success: false,
      error: err.message,
      code: 'VALIDATION_ERROR',
    });
  }

  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      error: 'Ya existe un registro con esos datos',
      code: 'DUPLICATE',
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: 'Registro no encontrado',
      code: 'NOT_FOUND',
    });
  }

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Error interno del servidor',
    code: err.code || 'INTERNAL_ERROR',
  });
};

module.exports = errorHandler;
