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

const actualizarNegocioBodySchema = z.object({
  nombre: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email('Email inválido').optional(),
  telefono: z.preprocess((val) => (val === '' ? null : val), z.union([z.string().max(60), z.null()]).optional()),
  direccion: z.preprocess((val) => (val === '' ? null : val), z.union([z.string().max(250), z.null()]).optional()),
  logo: z.preprocess((val) => (val === '' ? null : val), z.union([z.string().max(500), z.null()]).optional()),
  bannerUrl: z.preprocess((val) => (val === '' ? null : val), z.union([z.string().max(500), z.null()]).optional()),
  colorPrimario: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido').optional(),
  colorSecundario: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido').optional()
}).strip();

module.exports = {
  claveParamSchema,
  actualizarBodySchema,
  actualizarBulkBodySchema,
  actualizarNegocioBodySchema
};
