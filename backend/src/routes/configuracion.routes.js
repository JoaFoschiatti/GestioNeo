const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const configuracionController = require('../controllers/configuracion.controller');
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');

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
      cb(new Error('Solo se permiten imágenes (jpg, jpeg, png, webp)'));
    }
  }
});

// Rutas (todas requieren rol ADMIN excepto la pública)
router.get('/', verificarToken, verificarRol('ADMIN'), configuracionController.obtenerTodas);
router.put('/:clave', verificarToken, verificarRol('ADMIN'), configuracionController.actualizar);
router.put('/', verificarToken, verificarRol('ADMIN'), configuracionController.actualizarBulk);
router.post('/banner', verificarToken, verificarRol('ADMIN'), upload.single('banner'), configuracionController.subirBanner);

module.exports = router;
