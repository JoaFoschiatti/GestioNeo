const express = require('express');
const router = express.Router();
const mesasController = require('../controllers/mesas.controller');
const { verificarToken, esAdmin, esMozo } = require('../middlewares/auth.middleware');

router.use(verificarToken);

router.get('/', mesasController.listar);
router.get('/:id', mesasController.obtener);
router.post('/', esAdmin, mesasController.crear);
router.put('/:id', esAdmin, mesasController.actualizar);
router.patch('/:id/estado', esMozo, mesasController.cambiarEstado);
router.delete('/:id', esAdmin, mesasController.eliminar);

module.exports = router;
