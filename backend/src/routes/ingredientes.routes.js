const express = require('express');
const router = express.Router();
const ingredientesController = require('../controllers/ingredientes.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');

router.use(verificarToken);

router.get('/', ingredientesController.listar);
router.get('/alertas', ingredientesController.alertasStock);
router.get('/:id', ingredientesController.obtener);
router.post('/', esAdmin, ingredientesController.crear);
router.put('/:id', esAdmin, ingredientesController.actualizar);
router.post('/:id/movimiento', esAdmin, ingredientesController.registrarMovimiento);
router.post('/:id/ajuste', esAdmin, ingredientesController.ajustarStock);

module.exports = router;
