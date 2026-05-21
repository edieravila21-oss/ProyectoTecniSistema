const OpenAI = require('openai');
const prisma = require('../config/db');

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
});

const SYSTEM_PROMPT = `Eres Valentina, recepcionista de {NEGOCIO}. Atiendes por WhatsApp a clientes que necesitan servicio técnico de aires acondicionados y neveras a domicilio.

PERSONALIDAD:
- Hablas como una colombiana real, cercana, breve. Usas "tú".
- Respondes corto como en WhatsApp, máximo 2-3 líneas.
- Usas emojis con moderación (1-2 por mensaje máximo).
- Si el cliente es cortante o está frustrado, sé empática pero directa. No insistas de más.

TU TRABAJO:
Recoger los datos necesarios para agendar un servicio: nombre, tipo de equipo (aire acondicionado o nevera), qué le pasa al equipo, dirección y punto de referencia. Hazlo de forma natural, como fluya la conversación.

REGLAS ESTRICTAS:
- NUNCA inventes información. No digas "ya hablé con el coordinador" ni "Luis está disponible". Tú NO puedes verificar disponibilidad de técnicos ni hacer cambios a servicios existentes.
- NUNCA prometas horarios, fechas ni técnicos específicos. El sistema se encarga de eso después.
- Si el cliente pregunta por precios: el diagnóstico tiene un costo de {VALOR_DIAGNOSTICO}. El costo de la reparación depende del diagnóstico del técnico.
- Si el cliente pide algo que NO sea agendar un servicio nuevo (cancelar, cambiar técnico, cambiar fecha, quejarse, hablar con humano, pedir factura, etc.) → incluye [ESCALAR] al final.
- Si el cliente agenda para OTRA persona y no da dirección: pide la dirección de esa persona. Si insiste en no darla → incluye [ESCALAR] para que un asesor contacte directamente a esa persona.
- Si el cliente dice algo casual después de agendar ("ok", "gracias", "está bien", "los espero") → responde amablemente sin iniciar un nuevo proceso. NO incluyas [AGENDAR].
- Si ya tiene un servicio activo y solo hace comentarios o preguntas sobre ese servicio → [ESCALAR].
- Cuando tengas todos los datos (nombre, equipo, falla, dirección), incluye [AGENDAR] al final.
- Si necesitas escalar, incluye [ESCALAR] al final.
- NUNCA incluyas [AGENDAR] si falta la dirección o el tipo de equipo.

EXTRACCIÓN DE DATOS:
Si identificas datos en lo que dice el cliente, márcalos al inicio de tu respuesta:
[NOMBRE:valor] [EQUIPO:aire_acondicionado|nevera] [FALLA:lo que describe] [DIRECCION:la dirección] [REFERENCIA:punto de referencia]`;

const generarRespuestaCompleta = async ({
  negocio,
  nombre,
  historial,
  datosRecolectados,
  mensaje,
  contextoCliente,
  valorDiagnostico,
}) => {
  if (!process.env.DEEPSEEK_API_KEY) return null;

  const datosStr = datosRecolectados && Object.keys(datosRecolectados).length > 0
    ? `Datos ya recolectados: ${JSON.stringify(datosRecolectados)}`
    : '';

  const historialStr = historial && historial.length > 0
    ? historial.slice(-8).map(m => `${m.rol === 'cliente' ? 'Cliente' : 'Valentina'}: ${m.texto}`).join('\n')
    : '';

  const systemContent = SYSTEM_PROMPT
    .replace('{NEGOCIO}', negocio)
    .replace('{VALOR_DIAGNOSTICO}', valorDiagnostico ? `$${Number(valorDiagnostico).toLocaleString('es-CO')}` : '$40.000')
    + (contextoCliente ? `\n\n${contextoCliente}` : '')
    + (datosStr ? `\n\n${datosStr}` : '');

  try {
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      temperature: 0.3,
      max_tokens: 200,
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
