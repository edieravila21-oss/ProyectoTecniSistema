const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (date) => {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
};

const formatDateTime = (date) => {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(date));
};

const estadoLabels = {
  pendiente: 'Pendiente',
  asignado: 'Asignado',
  en_camino: 'En camino',
  en_servicio: 'En servicio',
  pausado: 'Pausado',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

const transicionesPermitidas = {
  pendiente: ['asignado', 'cancelado'],
  asignado: ['en_camino', 'cancelado'],
  en_camino: ['en_servicio', 'cancelado'],
  en_servicio: ['completado', 'cancelado', 'pausado'],
  pausado: ['en_servicio', 'cancelado'],
  completado: [],
  cancelado: [],
};

const validarTransicion = (estadoActual, nuevoEstado) => {
  return transicionesPermitidas[estadoActual]?.includes(nuevoEstado) || false;
};

const paginar = (page = 1, limit = 20) => {
  const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
  return { skip, take: parseInt(limit) };
};

const respuestaPaginada = (data, total, page, limit) => ({
  data,
  meta: {
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(total / parseInt(limit)),
  },
});

module.exports = {
  formatCurrency,
  formatDate,
  formatDateTime,
  estadoLabels,
  validarTransicion,
  paginar,
  respuestaPaginada,
};
