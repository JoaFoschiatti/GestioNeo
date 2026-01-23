require('dotenv').config({ quiet: true });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

// Importar rutas
const authRoutes = require('./routes/auth.routes');
const empleadosRoutes = require('./routes/empleados.routes');
const mesasRoutes = require('./routes/mesas.routes');
const categoriasRoutes = require('./routes/categorias.routes');
const productosRoutes = require('./routes/productos.routes');
const pedidosRoutes = require('./routes/pedidos.routes');
const ingredientesRoutes = require('./routes/ingredientes.routes');
const fichajesRoutes = require('./routes/fichajes.routes');
const liquidacionesRoutes = require('./routes/liquidaciones.routes');
const reportesRoutes = require('./routes/reportes.routes');
const pagosRoutes = require('./routes/pagos.routes');
const impresionRoutes = require('./routes/impresion.routes');
const eventosRoutes = require('./routes/eventos.routes');
const configuracionRoutes = require('./routes/configuracion.routes');
const publicoRoutes = require('./routes/publico.routes');
const cierresRoutes = require('./routes/cierres.routes');
const reservasRoutes = require('./routes/reservas.routes');
const modificadoresRoutes = require('./routes/modificadores.routes');
const registroRoutes = require('./routes/registro.routes');
const superadminRoutes = require('./routes/superadmin.routes');
const mercadopagoRoutes = require('./routes/mercadopago.routes');
const tenantRoutes = require('./routes/tenant.routes');

const { errorMiddleware } = require('./middlewares/error.middleware');
const { createHttpError } = require('./utils/http-error');

const app = express();

// Middlewares de seguridad
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (imágenes de productos)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/empleados', empleadosRoutes);
app.use('/api/mesas', mesasRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/ingredientes', ingredientesRoutes);
app.use('/api/fichajes', fichajesRoutes);
app.use('/api/liquidaciones', liquidacionesRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/impresion', impresionRoutes);
app.use('/api/eventos', eventosRoutes);
app.use('/api/configuracion', configuracionRoutes);
app.use('/api/publico', publicoRoutes);
app.use('/api/cierres', cierresRoutes);
app.use('/api/reservas', reservasRoutes);
app.use('/api/modificadores', modificadoresRoutes);
app.use('/api/registro', registroRoutes);
app.use('/api/super-admin', superadminRoutes);
app.use('/api/mercadopago', mercadopagoRoutes);
app.use('/api/tenant', tenantRoutes);

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Ruta 404
app.use((_req, _res, next) => next(createHttpError.notFound('Ruta no encontrada')));

// Manejo de errores global
app.use(errorMiddleware);

module.exports = app;
