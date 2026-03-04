const express = require('express');
const router = express.Router();
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');
const { setAuthContext, bloquearSiSoloLectura } = require('../middlewares/context.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const { getPrisma } = require('../utils/get-prisma');
const {
  obtenerParedesQuerySchema,
  guardarParedesBodySchema
} = require('../schemas/plano.schemas');

router.use(verificarToken);
router.use(setAuthContext);

// GET /api/plano/paredes?zona=Interior
router.get('/paredes',
  validate({ query: obtenerParedesQuerySchema }),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma(req);
    const clave = `plano_paredes_${req.query.zona}`;
    const config = await prisma.configuracion.findUnique({ where: { clave } });
    if (!config) return res.json([]);
    try {
      res.json(JSON.parse(config.valor));
    } catch {
      res.json([]);
    }
  })
);

// PUT /api/plano/paredes
router.put('/paredes',
  bloquearSiSoloLectura,
  esAdmin,
  validate({ body: guardarParedesBodySchema }),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma(req);
    const { zona, paredes } = req.body;
    const clave = `plano_paredes_${zona}`;
    const valor = JSON.stringify(paredes);
    await prisma.configuracion.upsert({
      where: { clave },
      update: { valor },
      create: { clave, valor }
    });
    res.json({ message: 'Paredes guardadas' });
  })
);

module.exports = router;
