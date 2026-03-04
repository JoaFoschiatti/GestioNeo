const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { fromFile } = require('file-type');
const configuracionController = require('../controllers/configuracion.controller');
const { verificarToken, verificarPermiso } = require('../middlewares/auth.middleware');
const { setAuthContext, bloquearSiSoloLectura } = require('../middlewares/context.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const { createHttpError } = require('../utils/http-error');
const { CAPABILITY } = require('../auth/permissions');
const {
  claveParamSchema,
  actualizarBodySchema,
  actualizarBulkBodySchema,
  actualizarNegocioBodySchema
} = require('../schemas/configuracion.schemas');

// Mapa de MIME detectado por magic bytes -> extensión segura
const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

// Configurar multer para subir banner
// Usamos nombre temporal; la extensión final se asigna tras validar magic bytes
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Extensión temporal segura; se renombra después de validar magic bytes
    cb(null, 'banner-' + uniqueSuffix + '.tmp');
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

const validateBannerMagicBytes = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    const detectedType = await fromFile(req.file.path);
    const allowedMimes = Object.keys(MIME_TO_EXT);

    if (!detectedType || !allowedMimes.includes(detectedType.mime)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: { message: 'El archivo no es una imagen valida. Solo se permiten jpeg, png o webp.' }
      });
    }

    // Renombrar con extensión segura basada en magic bytes (no en input del usuario)
    const safeExt = MIME_TO_EXT[detectedType.mime];
    const newPath = req.file.path.replace(/\.tmp$/, safeExt);
    fs.renameSync(req.file.path, newPath);
    req.file.path = newPath;
    req.file.filename = path.basename(newPath);

    return next();
  } catch (_error) {
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {
        // Archivo ya eliminado o inaccesible.
      }
    }
    return res.status(500).json({
      error: { message: 'Error al validar la imagen subida.' }
    });
  }
};

// Rutas (todas requieren rol ADMIN)
router.use(verificarToken);
router.use(setAuthContext);
router.use(verificarPermiso(CAPABILITY.SETTINGS_MANAGE));

router.get('/negocio', asyncHandler(configuracionController.obtenerNegocio));
router.put('/negocio', bloquearSiSoloLectura, validate({ body: actualizarNegocioBodySchema }), asyncHandler(configuracionController.actualizarNegocio));
router.get('/', asyncHandler(configuracionController.obtenerTodas));
router.put('/:clave', bloquearSiSoloLectura, validate({ params: claveParamSchema, body: actualizarBodySchema }), asyncHandler(configuracionController.actualizar));
router.put('/', bloquearSiSoloLectura, validate({ body: actualizarBulkBodySchema }), asyncHandler(configuracionController.actualizarBulk));
router.post(
  '/banner',
  bloquearSiSoloLectura,
  upload.single('banner'),
  validateBannerMagicBytes,
  asyncHandler(configuracionController.subirBanner)
);

module.exports = router;
