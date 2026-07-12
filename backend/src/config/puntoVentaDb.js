const { Pool } = require('pg');

let pool = null;

function getPuntoVentaPool() {
  if (!pool && process.env.PUNTO_VENTA_DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.PUNTO_VENTA_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

module.exports = { getPuntoVentaPool };
