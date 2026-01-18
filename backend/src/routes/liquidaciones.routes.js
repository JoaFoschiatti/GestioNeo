const express = require('express');
const router = express.Router();
const liquidacionesController = require('../controllers/liquidaciones.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');

router.use(verificarToken);
router.use(esAdmin);

router.get('/', liquidacionesController.listar);
router.get('/:id', liquidacionesController.obtener);
router.post('/calcular', liquidacionesController.calcular);
router.post('/', liquidacionesController.crear);
router.patch('/:id/pagar', liquidacionesController.marcarPagada);
router.delete('/:id', liquidacionesController.eliminar);

module.exports = router;
