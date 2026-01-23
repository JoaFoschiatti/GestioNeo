const express = require('express');
const router = express.Router();
const superadminController = require('../controllers/superadmin.controller');
const { verificarToken, esSuperAdmin } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const { idParamSchema, listarTenantsQuerySchema, toggleActivoBodySchema } = require('../schemas/superadmin.schemas');

// All super admin routes require authentication and SUPER_ADMIN role
router.use(verificarToken);
router.use(esSuperAdmin);

// GET /api/super-admin/tenants - List all tenants
router.get('/tenants', validate({ query: listarTenantsQuerySchema }), asyncHandler(superadminController.listarTenants));

// GET /api/super-admin/tenants/:id - Get tenant details
router.get('/tenants/:id', validate({ params: idParamSchema }), asyncHandler(superadminController.obtenerTenant));

// PATCH /api/super-admin/tenants/:id/toggle - Toggle tenant active status
router.patch(
  '/tenants/:id/toggle',
  validate({ params: idParamSchema, body: toggleActivoBodySchema }),
  asyncHandler(superadminController.toggleActivo)
);

// GET /api/super-admin/tenants/:id/metricas - Get tenant metrics
router.get('/tenants/:id/metricas', validate({ params: idParamSchema }), asyncHandler(superadminController.obtenerMetricas));

// GET /api/super-admin/metricas - Get global platform metrics
router.get('/metricas', asyncHandler(superadminController.obtenerMetricasGlobales));

module.exports = router;
