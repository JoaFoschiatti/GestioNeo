const express = require('express');
const router = express.Router();
const pedidosController = require('../controllers/pedidos.controller');
const { verificarToken, esMozo, esAdminOCajero, verificarRol } = require('../middlewares/auth.middleware');

router.use(verificarToken);

router.get('/', pedidosController.listar);
router.get('/cocina', verificarRol('ADMIN', 'COCINERO'), pedidosController.pedidosCocina);
router.get('/delivery', verificarRol('ADMIN', 'DELIVERY'), pedidosController.pedidosDelivery);
router.get('/:id', pedidosController.obtener);
router.post('/', verificarRol('ADMIN', 'CAJERO', 'MOZO'), pedidosController.crear);
router.patch('/:id/estado', pedidosController.cambiarEstado);
router.post('/:id/items', esMozo, pedidosController.agregarItems);
router.post('/:id/cancelar', esAdminOCajero, pedidosController.cancelar);

module.exports = router;
