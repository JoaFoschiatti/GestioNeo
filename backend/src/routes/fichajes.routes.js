const express = require('express');
const router = express.Router();
const fichajesController = require('../controllers/fichajes.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');

router.use(verificarToken);

router.get('/', fichajesController.listar);
router.post('/entrada', fichajesController.registrarEntrada);
router.post('/salida', fichajesController.registrarSalida);
router.get('/empleado/:empleadoId/estado', fichajesController.estadoEmpleado);
router.get('/empleado/:empleadoId/horas', fichajesController.calcularHoras);
router.put('/:id', esAdmin, fichajesController.editar);

module.exports = router;
