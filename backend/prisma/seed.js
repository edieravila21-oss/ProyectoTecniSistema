require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Usamos pg directo para evitar problemas con el cliente local de Prisma
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    console.log('[seed] Verificando datos de producción...');

    // ── Admin ────────────────────────────────────────────────────────────────
    const { rows: admins } = await client.query(
      "SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1"
    );
    if (admins.length === 0) {
      const hash = await bcrypt.hash('1234', 10);
      await client.query(
        `INSERT INTO usuarios (id,nombre,email,password,rol,telefono,activo,especialidad,"createdAt","updatedAt")
         VALUES (gen_random_uuid(),$1,$2,$3,'admin',$4,true,'ambos',now(),now())`,
        ['Administrador', 'admin@refrielectri.com', hash, '573000000000']
      );
      console.log('[seed] Admin creado');
    } else {
      console.log('[seed] Admin ya existe — sin cambios');
    }

    // ── Configuración ────────────────────────────────────────────────────────
    const { rows: conf } = await client.query('SELECT id FROM configuracion LIMIT 1');
    if (conf.length === 0) {
      await client.query(
        `INSERT INTO configuracion
           (id,nombre_negocio,telefono_negocio,hora_inicio,hora_fin,valor_diagnostico,
            mensaje_bienvenida,meses_recordatorio,bot_debounce_ms,bot_max_espera_ms,
            bot_typing_espera_ms,bot_delay_respuesta_ms,"createdAt","updatedAt")
         VALUES
           (gen_random_uuid(),'RefriElectri Pro','573000000000','07:00','20:00',40000,
            'Bienvenido a RefriElectri Pro, servicio técnico en aires y neveras.',6,
            3000,30000,1500,800,now(),now())`
      );
      console.log('[seed] Configuración creada');
    } else {
      console.log('[seed] Configuración ya existe — sin cambios');
    }

    // ── SLA config ───────────────────────────────────────────────────────────
    const { rows: slas } = await client.query('SELECT id FROM "ConfiguracionSLA" LIMIT 1');
    if (slas.length === 0) {
      const slaData = [
        ['diagnostico', 15, 30, 'Diagnóstico rápido del equipo'],
        ['mantenimiento', 15, 45, 'Mantenimiento preventivo y limpieza'],
        ['reparacion', 15, 120, 'Reparación de componentes'],
        ['instalacion', 15, 180, 'Instalación de nuevo equipo'],
      ];
      for (const [tipo, camino, ejecucion, desc] of slaData) {
        await client.query(
          `INSERT INTO "ConfiguracionSLA"
             (id,tipo_servicio,max_tiempo_camino_min,max_tiempo_ejecucion_min,descripcion,activo,"createdAt","updatedAt")
           VALUES (gen_random_uuid(),$1,$2,$3,$4,true,now(),now())`,
          [tipo, camino, ejecucion, desc]
        );
      }
      console.log('[seed] SLA config creado');
    } else {
      console.log('[seed] SLA config ya existe — sin cambios');
    }

    console.log('[seed] Listo. Ningún dato de producción fue modificado.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => {
  console.error('[seed] Error:', e.message);
  process.exit(1);
});
