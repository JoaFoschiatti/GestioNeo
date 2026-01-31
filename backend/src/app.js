require('dotenv').config({ quiet: true });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
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
const mercadopagoRoutes = require('./routes/mercadopago.routes');
const suscripcionRoutes = require('./routes/suscripcion.routes');
const transferenciasRoutes = require('./routes/transferencias.routes');

const { errorMiddleware } = require('./middlewares/error.middleware');
const { createHttpError } = require('./utils/http-error');
const { logger } = require('./utils/logger');

const app = express();

// HTTPS redirect in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    // Check if request came through HTTPS (works with proxies like nginx, Railway, Vercel)
    const forwardedProto = req.header('x-forwarded-proto');
    if (forwardedProto && forwardedProto !== 'https') {
      return res.redirect(301, `https://${req.header('host')}${req.url}`);
    }
    next();
  });
}

// Middlewares de seguridad
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  }
}));

// CORS - Strict configuration for production
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : [];

// In production, FRONTEND_URL must be explicitly set
if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  logger.error('FRONTEND_URL environment variable must be set in production');
  process.exit(1);
}

// In development, allow localhost if FRONTEND_URL not set
if (allowedOrigins.length === 0) {
  allowedOrigins.push('http://localhost:5173');
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

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
app.use('/api/mercadopago', mercadopagoRoutes);
app.use('/api/suscripcion', suscripcionRoutes);
app.use('/api/transferencias', transferenciasRoutes);

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Ruta 404
app.use((_req, _res, next) => next(createHttpError.notFound('Ruta no encontrada')));

// Manejo de errores global
app.use(errorMiddleware);

module.exports = app;
