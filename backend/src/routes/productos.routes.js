const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const productosController = require('../controllers/productos.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');
const { setTenantFromAuth, bloquearSiSoloLectura } = require('../middlewares/tenant.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const {
  idParamSchema,
  listarQuerySchema,
  crearProductoBodySchema,
  actualizarProductoBodySchema,
  cambiarDisponibilidadBodySchema,
  crearVarianteBodySchema,
  actualizarVarianteBodySchema,
  agruparVariantesBodySchema
} = require('../schemas/productos.schemas');

// Configuración de multer para subida de imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'producto-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    const error = new Error('Solo se permiten imágenes (jpeg, jpg, png, webp)');
    error.status = 400;
    cb(error);
  }
});

router.use(verificarToken);
router.use(setTenantFromAuth);

// Rutas para productos
router.get('/', validate({ query: listarQuerySchema }), asyncHandler(productosController.listar));
router.get('/con-variantes', validate({ query: listarQuerySchema }), asyncHandler(productosController.listarConVariantes));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(productosController.obtener));
router.post(
  '/',
  bloquearSiSoloLectura,
  esAdmin,
  upload.single('imagen'),
  validate({ body: crearProductoBodySchema }),
  asyncHandler(productosController.crear)
);
router.put(
  '/:id',
  bloquearSiSoloLectura,
  esAdmin,
  upload.single('imagen'),
  validate({ params: idParamSchema, body: actualizarProductoBodySchema }),
  asyncHandler(productosController.actualizar)
);
router.patch(
  '/:id/disponibilidad',
  bloquearSiSoloLectura,
  esAdmin,
  validate({ params: idParamSchema, body: cambiarDisponibilidadBodySchema }),
  asyncHandler(productosController.cambiarDisponibilidad)
);
router.delete('/:id', bloquearSiSoloLectura, esAdmin, validate({ params: idParamSchema }), asyncHandler(productosController.eliminar));

// Rutas para variantes de productos
router.post(
  '/:id/variantes',
  bloquearSiSoloLectura,
  esAdmin,
  validate({ params: idParamSchema, body: crearVarianteBodySchema }),
  asyncHandler(productosController.crearVariante)
);
router.put(
  '/:id/variante',
  bloquearSiSoloLectura,
  esAdmin,
  validate({ params: idParamSchema, body: actualizarVarianteBodySchema }),
  asyncHandler(productosController.actualizarVariante)
);
router.delete(
  '/:id/desagrupar',
  bloquearSiSoloLectura,
  esAdmin,
  validate({ params: idParamSchema }),
  asyncHandler(productosController.desagruparVariante)
);
router.post(
  '/agrupar-variantes',
  bloquearSiSoloLectura,
  esAdmin,
  validate({ body: agruparVariantesBodySchema }),
  asyncHandler(productosController.agruparComoVariantes)
);

module.exports = router;
