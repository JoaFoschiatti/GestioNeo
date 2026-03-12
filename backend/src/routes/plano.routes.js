const express = require('express');
const router = express.Router();
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const { getPrisma } = require('../utils/get-prisma');
const { obtenerParedesQuerySchema, guardarParedesBodySchema } = require('../schemas/plano.schemas');

router.use(verificarToken);

// GET /api/plano/paredes?zona=Interior
router.get('/paredes', validate({ query: obtenerParedesQuerySchema }), asyncHandler(async (req, res) => {
  const prisma = getPrisma(req);
  const { zona } = req.query;
  const clave = `plano_paredes_${zona}`;

  const config = await prisma.configuracion.findFirst({
    where: { clave }
  });

  if (!config) return res.json([]);
  try {
    res.json(JSON.parse(config.valor));
  } catch {
    res.json([]);
  }
}));

// PUT /api/plano/paredes
router.put('/paredes', esAdmin, validate({ body: guardarParedesBodySchema }), asyncHandler(async (req, res) => {
  const prisma = getPrisma(req);
  const { zona, paredes } = req.body;
  const clave = `plano_paredes_${zona}`;

  await prisma.configuracion.upsert({
    where: { clave },
    update: { valor: JSON.stringify(paredes) },
    create: { clave, valor: JSON.stringify(paredes) }
  });

  res.json({ message: 'Paredes guardadas', paredes });
}));

module.exports = router;

