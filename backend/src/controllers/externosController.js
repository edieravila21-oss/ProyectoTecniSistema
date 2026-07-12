const { getPuntoVentaPool } = require('../config/puntoVentaDb');

const getProductos = async (req, res) => {
  const pool = getPuntoVentaPool();
  if (!pool) return res.status(503).json({ success: false, error: 'Punto de venta no configurado' });

  const { q = '' } = req.query;
  const search = `%${q.trim()}%`;

  try {
    const result = await pool.query(
      `SELECT id, codigo, nombre, precio, categoria
       FROM "Producto"
       WHERE activo = true
         AND ($1 = '%%' OR UPPER(nombre) LIKE UPPER($1) OR codigo LIKE $1)
       ORDER BY nombre
       LIMIT 50`,
      [search]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[PuntoVenta] Error consultando productos:', err.message);
    res.status(500).json({ success: false, error: 'Error consultando inventario' });
  }
};

const getProductosComunes = async (req, res) => {
  const pool = getPuntoVentaPool();
  if (!pool) return res.status(503).json({ success: false, error: 'Punto de venta no configurado' });

  try {
    const result = await pool.query(
      `SELECT p.id, p.codigo, p.nombre, p.precio, p.categoria
       FROM "ItemVenta" iv
       JOIN "Producto" p ON p.id = iv."productoId"
       WHERE p.activo = true AND p.precio > 0
       GROUP BY p.id, p.codigo, p.nombre, p.precio, p.categoria
       ORDER BY SUM(iv.cantidad) DESC
       LIMIT 6`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[PuntoVenta] Error consultando productos comunes:', err.message);
    res.status(500).json({ success: false, error: 'Error consultando inventario' });
  }
};

module.exports = { getProductos, getProductosComunes };
