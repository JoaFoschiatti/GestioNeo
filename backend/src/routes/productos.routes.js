const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const productosController = require('../controllers/productos.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');

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
    cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, webp)'));
  }
});

router.use(verificarToken);

router.get('/', productosController.listar);
router.get('/:id', productosController.obtener);
router.post('/', esAdmin, upload.single('imagen'), productosController.crear);
router.put('/:id', esAdmin, upload.single('imagen'), productosController.actualizar);
router.patch('/:id/disponibilidad', esAdmin, productosController.cambiarDisponibilidad);
router.delete('/:id', esAdmin, productosController.eliminar);

module.exports = router;
