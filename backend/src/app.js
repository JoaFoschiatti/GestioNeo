require('dotenv').config({ quiet: true });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');

// Importar rutas
const authRoutes = require('./routes/auth.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
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
const negocioRoutes = require('./routes/negocio.routes');
const facturacionRoutes = require('./routes/facturacion.routes');
const planoRoutes = require('./routes/plano.routes');

const { errorMiddleware } = require('./middlewares/error.middleware');
const { createHttpError } = require('./utils/http-error');
const { logger } = require('./utils/logger');
const { getReadinessStatus } = require('./services/health.service');

const app = express();

// HTTPS redirect in production
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);

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
const allowedOrigins = new Set(
  process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((url) => url.trim()).filter(Boolean)
    : []
);

// In production, startup validation should reject a missing FRONTEND_URL.
if (process.env.NODE_ENV === 'production' && allowedOrigins.size === 0) {
  logger.warn('FRONTEND_URL no esta configurado. CORS rechazara requests desde navegador en produccion.');
}

// In development/test, allow the local Vite hosts used by frontend and Playwright.
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.add('http://localhost:5173');
  allowedOrigins.add('http://127.0.0.1:5173');
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.has(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Parsers
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());

// Servir archivos estáticos (imágenes de productos)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
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
app.use('/api/negocio', negocioRoutes);
app.use('/api/facturacion', facturacionRoutes);
app.use('/api/plano', planoRoutes);

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/ready', async (_req, res) => {
  const readiness = await getReadinessStatus();
  res.status(readiness.status === 'ready' ? 200 : 503).json(readiness);
});

// Ruta 404
app.use((_req, _res, next) => next(createHttpError.notFound('Ruta no encontrada')));

// Manejo de errores global
app.use(errorMiddleware);

module.exports = app;
