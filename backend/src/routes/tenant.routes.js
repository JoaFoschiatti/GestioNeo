/**
 * Rutas de Tenant
 * Permite al admin gestionar los datos de su negocio
 */

const express = require('express');
const router = express.Router();
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');
const { setTenantFromAuth } = require('../middlewares/tenant.middleware');
const tenantController = require('../controllers/tenant.controller');

// Todas las rutas requieren autenticación + rol ADMIN + contexto de tenant
const authMiddleware = [verificarToken, setTenantFromAuth, verificarRol('ADMIN')];

// GET /api/tenant - Obtener datos del tenant actual
router.get('/', ...authMiddleware, tenantController.obtenerTenant);

// PUT /api/tenant - Actualizar datos del tenant
router.put('/', ...authMiddleware, tenantController.actualizarTenant);

// GET /api/tenant/verificar-slug/:slug - Verificar disponibilidad de slug
router.get('/verificar-slug/:slug', ...authMiddleware, tenantController.verificarSlug);

module.exports = router;
