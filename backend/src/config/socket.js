const { Server } = require('socket.io');

let io = null;

const initSocket = (server) => {
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? (process.env.FRONTEND_URL || '').split(',').map(o => o.trim()).filter(Boolean)
    : ['http://localhost:5173', 'http://localhost:3000'];

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`Socket conectado: ${socket.id}`);

    socket.on('admin_conectado', () => {
      socket.join('admin');
      try {
        const { getEstado } = require('../whatsapp/bot');
        socket.emit('whatsapp_estado', getEstado());
      } catch (_) {}
    });

    socket.on('tecnico_disponible', (data) => {
      io.to('admin').emit('tecnico_estado', data);
    });

    socket.on('join_servicio', (servicioId) => {
      socket.join(`servicio_${servicioId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket desconectado: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io no inicializado');
  return io;
};

module.exports = { initSocket, getIO };
