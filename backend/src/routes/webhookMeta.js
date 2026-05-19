const router = require('express').Router();

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'techserv_pro_webhook_2026';

// Meta envía un GET para verificar el webhook
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Webhook Meta] ✅ Verificación exitosa');
    return res.status(200).send(challenge);
  }

  console.log('[Webhook Meta] ❌ Verificación fallida — token no coincide');
  return res.sendStatus(403);
});

// Meta envía un POST con mensajes entrantes y actualizaciones de estado
router.post('/', (req, res) => {
  const body = req.body;

  // Responder 200 inmediatamente (Meta requiere respuesta en <5s)
  res.sendStatus(200);

  if (body.object !== 'whatsapp_business_account') return;

  const entries = body.entry || [];
  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      if (change.field !== 'messages') continue;

      const value = change.value;
      const metadata = value.metadata;
      const contacts = value.contacts || [];
      const messages = value.messages || [];
      const statuses = value.statuses || [];

      // Mensajes entrantes
      for (const msg of messages) {
        const telefono = msg.from;
        const nombre = contacts.find(c => c.wa_id === telefono)?.profile?.name || '';
        const tipo = msg.type;

        let contenido = '';
        if (tipo === 'text') contenido = msg.text?.body || '';
        else if (tipo === 'interactive') {
          const interactive = msg.interactive;
          if (interactive?.type === 'button_reply') contenido = interactive.button_reply?.title || '';
          else if (interactive?.type === 'list_reply') contenido = interactive.list_reply?.title || '';
        } else {
          contenido = `[${tipo}]`;
        }

        console.log(`[Webhook Meta] 📩 Mensaje de ${telefono} (${nombre}): ${contenido}`);

        // TODO: Conectar con manejarMensaje cuando migres completamente
        // const { manejarMensaje } = require('../whatsapp/flujo');
        // manejarMensaje(cloudApiSock, telefono, telefono, contenido, sesiones);
      }

      // Actualizaciones de estado (entregado, leído, etc.)
      for (const status of statuses) {
        console.log(`[Webhook Meta] 📊 Status ${status.recipient_id}: ${status.status}`);
      }
    }
  }
});

module.exports = router;
