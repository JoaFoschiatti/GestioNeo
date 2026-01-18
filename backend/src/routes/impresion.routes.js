const express = require('express');
const router = express.Router();
const impresionController = require('../controllers/impresion.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

router.use(verificarToken);

router.post('/comanda/:pedidoId', impresionController.imprimirComanda);
router.get('/comanda/:pedidoId/preview', impresionController.previewComanda);
router.post('/comanda/:pedidoId/reimprimir', impresionController.reimprimirComanda);
router.get('/estado', impresionController.estadoImpresora);

module.exports = router;
