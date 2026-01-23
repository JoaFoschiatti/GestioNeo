const { z } = require('zod');

const claveParamSchema = z.object({
  clave: z.string().min(1)
});

const valorSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null()
]);

const actualizarBodySchema = z.object({
  valor: valorSchema
}).strip();

const actualizarBulkBodySchema = z.record(valorSchema);

module.exports = {
  claveParamSchema,
  actualizarBodySchema,
  actualizarBulkBodySchema
};
