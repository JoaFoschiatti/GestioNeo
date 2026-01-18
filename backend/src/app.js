require('dotenv').config();
const express = require('express');
const cors = require('cors');
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

const app = express();

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
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

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Error interno del servidor',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// Ruta 404
app.use((req, res) => {
  res.status(404).json({ error: { message: 'Ruta no encontrada' } });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 GestioNeo API corriendo en http://localhost:${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
