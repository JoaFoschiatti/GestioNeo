const express = require('express');
const router = express.Router();
const empleadosController = require('../controllers/empleados.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');

router.use(verificarToken);

router.get('/', empleadosController.listar);
router.get('/:id', empleadosController.obtener);
router.post('/', esAdmin, empleadosController.crear);
router.put('/:id', esAdmin, empleadosController.actualizar);
router.delete('/:id', esAdmin, empleadosController.eliminar);

module.exports = router;
