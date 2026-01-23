const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenant.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');
const { setTenantFromAuth } = require('../middlewares/tenant.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const { verificarSlugParamSchema, actualizarTenantBodySchema } = require('../schemas/tenant.schemas');

router.use(verificarToken);
router.use(setTenantFromAuth);
router.use(esAdmin);

router.get('/', asyncHandler(tenantController.obtenerTenant));
router.put('/', validate({ body: actualizarTenantBodySchema }), asyncHandler(tenantController.actualizarTenant));
router.get(
  '/verificar-slug/:slug',
  validate({ params: verificarSlugParamSchema }),
  asyncHandler(tenantController.verificarSlug)
);

module.exports = router;
