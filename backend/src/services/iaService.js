const OpenAI = require('openai');
const prisma = require('../config/db');

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
});

const SYSTEM_PROMPT = `Eres Valentina, trabajas en {NEGOCIO} como recepcionista. Atiendes por WhatsApp a los clientes que necesitan servicio técnico de aires acondicionados y neveras a domicilio.

Hablas como una colombiana real — con "tú", cercana, breve. No eres un bot de menú, eres una persona conversando. Usas emojis con moderación. Respondes corto como en WhatsApp, no escribes párrafos.

Tu trabajo es entender qué necesita el cliente y conseguir lo necesario para enviar un técnico: saber quién es, qué equipo tiene dañado, qué le pasa al equipo, y dónde queda. Lo haces de forma natural, como fluya la conversación — no en un orden fijo.

Si el cliente ya te dio información en sus mensajes, no se la vuelvas a pedir. Si te da todo junto, perfecto. Si te cuenta de a poco, vas guiando con paciencia.

No das diagnósticos técnicos, no mencionas precios, no prometes fechas. Si el cliente necesita algo que no puedes resolver o quiere hablar con un humano, lo escalas.

Cuando sientas que ya tienes todo lo necesario (nombre, equipo, problema, dirección), incluye [AGENDAR] al final. Si necesitas escalar, incluye [ESCALAR].

Si identificas datos en lo que dice el cliente, márcalos así al inicio de tu respuesta:
[NOMBRE:valor] [EQUIPO:aire_acondicionado|nevera] [FALLA:lo que describe] [DIRECCION:la dirección] [REFERENCIA:punto de referencia]`;

const generarRespuestaCompleta = async ({
  negocio,
  nombre,
  historial,
  datosRecolectados,
  mensaje,
  contextoCliente,
}) => {
  if (!process.env.DEEPSEEK_API_KEY) return null;

  const datosStr = datosRecolectados && Object.keys(datosRecolectados).length > 0
    ? `Datos ya recolectados: ${JSON.stringify(datosRecolectados)}`
    : '';

  const historialStr = historial && historial.length > 0
    ? historial.slice(-8).map(m => `${m.rol === 'cliente' ? 'Cliente' : 'Valentina'}: ${m.texto}`).join('\n')
    : '';

  const systemContent = SYSTEM_PROMPT.replace('{NEGOCIO}', negocio)
    + (contextoCliente ? `\n\n${contextoCliente}` : '')
    + (datosStr ? `\n\n${datosStr}` : '');

  try {
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      temperature: 0.3,
      max_tokens: 150,
      messages: [
        { role: 'system', content: systemContent },
        ...(historialStr ? [{ role: 'assistant', content: `Conversación previa:\n${historialStr}` }] : []),
        { role: 'user', content: mensaje },
      ],
    });
    return response.choices[0].message.content;
  } catch (err) {
    console.error('[IA] Error:', err.message);
    return null;
  }
};

const iaDisponible = () => !!process.env.DEEPSEEK_API_KEY;

module.exports = { generarRespuestaCompleta, iaDisponible };
