const express = require('express');
const router = express.Router();
const pagosController = require('../controllers/pagos.controller');
const { verificarToken, esAdminOCajero } = require('../middlewares/auth.middleware');

// Webhook público de MercadoPago (sin auth)
router.post('/webhook/mercadopago', pagosController.webhookMercadoPago);

// Rutas protegidas
router.use(verificarToken);

router.post('/', esAdminOCajero, pagosController.registrarPago);
router.post('/mercadopago/preferencia', pagosController.crearPreferenciaMercadoPago);
router.get('/pedido/:pedidoId', pagosController.listarPagosPedido);

module.exports = router;
