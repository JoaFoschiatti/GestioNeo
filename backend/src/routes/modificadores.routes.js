const express = require('express');
const router = express.Router();
const modificadoresController = require('../controllers/modificadores.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');

// Todas las rutas requieren autenticación
router.use(verificarToken);

// GET /api/modificadores - Listar modificadores
router.get('/', modificadoresController.listar);

// GET /api/modificadores/:id - Obtener modificador
router.get('/:id', modificadoresController.obtener);

// GET /api/modificadores/producto/:productoId - Modificadores de un producto
router.get('/producto/:productoId', modificadoresController.modificadoresDeProducto);

// POST /api/modificadores - Crear modificador (solo admin)
router.post('/', esAdmin, modificadoresController.crear);

// PUT /api/modificadores/:id - Actualizar modificador (solo admin)
router.put('/:id', esAdmin, modificadoresController.actualizar);

// DELETE /api/modificadores/:id - Eliminar modificador (solo admin)
router.delete('/:id', esAdmin, modificadoresController.eliminar);

// PUT /api/modificadores/producto/:productoId - Asignar modificadores a producto (solo admin)
router.put('/producto/:productoId', esAdmin, modificadoresController.asignarAProducto);

module.exports = router;
