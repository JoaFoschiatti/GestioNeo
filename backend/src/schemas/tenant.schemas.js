const { z } = require('zod');

const slugSchema = z.string()
  .min(3)
  .max(50)
  .regex(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/, 'Slug inválido');

const emailSchema = z.string().trim().email('Email inválido');

const verificarSlugParamSchema = z.object({
  slug: slugSchema
}).strip();

const actualizarTenantBodySchema = z.object({
  slug: slugSchema.optional(),
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
  email: emailSchema.optional(),
  telefono: z.preprocess((val) => (val === '' ? null : val), z.union([z.string(), z.null()]).optional()),
  direccion: z.preprocess((val) => (val === '' ? null : val), z.union([z.string(), z.null()]).optional()),
  colorPrimario: z.string().optional(),
  colorSecundario: z.string().optional()
}).strip();

module.exports = {
  slugSchema,
  verificarSlugParamSchema,
  actualizarTenantBodySchema
};
