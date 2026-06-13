require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const { initSocket } = require('./src/config/socket');
const errorHandler = require('./src/middlewares/errorHandler');

const app = express();
const server = http.createServer(app);

initSocket(server);

app.use(helmet());
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? (process.env.FRONTEND_URL || '').split(',').map(o => o.trim()).filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origen no permitido → ${origin}`));
  },
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Webhook de Meta (sin auth - Meta lo llama directamente)
app.use('/webhook', require('./src/routes/webhookMeta'));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/usuarios', require('./src/routes/usuarios'));
app.use('/api/clientes', require('./src/routes/clientes'));
app.use('/api/servicios', require('./src/routes/servicios'));
app.use('/api/metricas', require('./src/routes/metricas'));
app.use('/api/sla-config', require('./src/routes/sla'));
app.use('/api/whatsapp', require('./src/routes/whatsapp'));
app.use('/api/evaluaciones', require('./src/routes/evaluaciones'));
app.use('/api/configuracion', require('./src/routes/configuracion'));
app.use('/api/calendario', require('./src/routes/calendario'));

app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date() } });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`[Server] RefriElectri Pro corriendo en puerto ${PORT}`);

  if (process.env.WHATSAPP_ENABLED === 'true') {
    try {
      const { iniciar } = require('./src/whatsapp/bot');
      await iniciar();
    } catch (err) {
      console.error('[WhatsApp] Error al iniciar:', err.message);
    }
  }

  const { iniciarScheduler } = require('./src/services/recordatorioService');
  iniciarScheduler();
});

module.exports = app;
