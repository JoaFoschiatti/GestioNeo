const express = require('express');
const router = express.Router();
const superadminController = require('../controllers/superadmin.controller');
const { verificarToken, esSuperAdmin } = require('../middlewares/auth.middleware');

// All super admin routes require authentication and SUPER_ADMIN role
router.use(verificarToken);
router.use(esSuperAdmin);

// GET /api/super-admin/tenants - List all tenants
router.get('/tenants', superadminController.listarTenants);

// GET /api/super-admin/tenants/:id - Get tenant details
router.get('/tenants/:id', superadminController.obtenerTenant);

// PATCH /api/super-admin/tenants/:id/toggle - Toggle tenant active status
router.patch('/tenants/:id/toggle', superadminController.toggleActivo);

// GET /api/super-admin/tenants/:id/metricas - Get tenant metrics
router.get('/tenants/:id/metricas', superadminController.obtenerMetricas);

// GET /api/super-admin/metricas - Get global platform metrics
router.get('/metricas', superadminController.obtenerMetricasGlobales);

module.exports = router;
