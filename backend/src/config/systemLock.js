// Interruptor manual para bloquear el acceso a todo el sistema (admin y técnicos).
// Cambiar a `true` y desplegar para bloquear; a `false` para restaurar el acceso.
// El frontend consulta esto por API cada cierto tiempo, así que basta con
// redesplegar el backend — no hace falta que los usuarios refresquen nada.
module.exports.SISTEMA_BLOQUEADO = true;
