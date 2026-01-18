const express = require('express');
const router = express.Router();
const categoriasController = require('../controllers/categorias.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');

// Ruta pública para la carta
router.get('/publicas', categoriasController.listarPublicas);

// Rutas protegidas
router.use(verificarToken);
router.get('/', categoriasController.listar);
router.post('/', esAdmin, categoriasController.crear);
router.put('/:id', esAdmin, categoriasController.actualizar);
router.delete('/:id', esAdmin, categoriasController.eliminar);

module.exports = router;
