const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const configuracionController = require('../controllers/configuracion.controller');
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');
const { setTenantFromAuth } = require('../middlewares/tenant.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const { createHttpError } = require('../utils/http-error');
const {
  claveParamSchema,
  actualizarBodySchema,
  actualizarBulkBodySchema
} = require('../schemas/configuracion.schemas');

// Configurar multer para subir banner
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extname = path.extname(file.originalname).toLowerCase();
    cb(null, 'banner-' + uniqueSuffix + extname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB para banner
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(createHttpError.badRequest('Solo se permiten imágenes (jpg, jpeg, png, webp)'));
    }
  }
});

// Rutas (todas requieren rol ADMIN + tenant context)
router.use(verificarToken);
router.use(setTenantFromAuth);
router.use(verificarRol('ADMIN'));

router.get('/', asyncHandler(configuracionController.obtenerTodas));
router.put('/:clave', validate({ params: claveParamSchema, body: actualizarBodySchema }), asyncHandler(configuracionController.actualizar));
router.put('/', validate({ body: actualizarBulkBodySchema }), asyncHandler(configuracionController.actualizarBulk));
router.post('/banner', upload.single('banner'), asyncHandler(configuracionController.subirBanner));

module.exports = router;
