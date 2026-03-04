const express = require('express');
const router = express.Router();
const multer = require('multer');
const afipController = require('../controllers/afip.controller');
const { verificarToken, verificarPermiso } = require('../middlewares/auth.middleware');
const { setAuthContext, bloquearSiSoloLectura } = require('../middlewares/context.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const { CAPABILITY } = require('../auth/permissions');
const {
  configurarFiscalBodySchema,
  toggleModoBodySchema,
  generarCsrBodySchema
} = require('../schemas/afip.schemas');

// Multer para upload de certificados (en memoria)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 }, // 50KB max por archivo
  fileFilter: (req, file, cb) => {
    // Aceptar .crt, .pem, .key
    const allowed = ['.crt', '.pem', '.key', '.cer'];
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    if (allowed.includes(ext) || file.mimetype === 'application/x-pem-file' || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido: ${ext}`));
    }
  }
});

router.use(verificarToken);
router.use(setAuthContext);

// Todas las rutas requieren ADMIN (SETTINGS_MANAGE)
router.get('/estado', verificarPermiso(CAPABILITY.SETTINGS_MANAGE), asyncHandler(afipController.obtenerEstadoFiscal));
router.put('/fiscal', bloquearSiSoloLectura, verificarPermiso(CAPABILITY.SETTINGS_MANAGE), validate({ body: configurarFiscalBodySchema }), asyncHandler(afipController.configurarFiscal));
router.post('/certificado', bloquearSiSoloLectura, verificarPermiso(CAPABILITY.SETTINGS_MANAGE), upload.fields([
  { name: 'certificado', maxCount: 1 },
  { name: 'clavePrivada', maxCount: 1 }
]), asyncHandler(afipController.subirCertificado));
router.post('/csr', bloquearSiSoloLectura, verificarPermiso(CAPABILITY.SETTINGS_MANAGE), validate({ body: generarCsrBodySchema }), asyncHandler(afipController.generarCSR));
router.post('/certificado/solo-crt', bloquearSiSoloLectura, verificarPermiso(CAPABILITY.SETTINGS_MANAGE), upload.single('certificado'), asyncHandler(afipController.subirSoloCertificado));
router.post('/test', verificarPermiso(CAPABILITY.SETTINGS_MANAGE), asyncHandler(afipController.testConexion));
router.put('/modo', bloquearSiSoloLectura, verificarPermiso(CAPABILITY.SETTINGS_MANAGE), validate({ body: toggleModoBodySchema }), asyncHandler(afipController.toggleModo));

module.exports = router;
