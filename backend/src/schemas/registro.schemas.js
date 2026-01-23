const { z } = require('zod');

const slugStrictSchema = z.string()
  .min(3)
  .max(50)
  .regex(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/, 'Slug inválido');

const registrarBodySchema = z.object({
  slug: slugStrictSchema,
  nombreRestaurante: z.string({ required_error: 'Nombre del restaurante requerido' })
    .min(1, 'Nombre del restaurante requerido'),
  nombre: z.string({ required_error: 'Nombre requerido' }).min(1, 'Nombre requerido'),
  email: z.string({ required_error: 'Email requerido' }).min(1, 'Email requerido').email('Email inválido'),
  password: z.string({ required_error: 'Password requerido' }).min(6, 'La contraseña debe tener al menos 6 caracteres'),
  telefono: z.preprocess((val) => (val === '' ? null : val), z.union([z.string(), z.null()]).optional()),
  direccion: z.preprocess((val) => (val === '' ? null : val), z.union([z.string(), z.null()]).optional())
}).strip();

const verificarEmailParamSchema = z.object({
  token: z.string({ required_error: 'Token requerido' }).min(1, 'Token requerido')
}).strip();

const reenviarBodySchema = z.object({
  email: z.string({ required_error: 'Email requerido' }).min(1, 'Email requerido').email('Email inválido')
}).strip();

const verificarSlugParamSchema = z.object({
  slug: z.string({ required_error: 'Slug requerido' }).min(1, 'Slug requerido')
}).strip();

module.exports = {
  slugStrictSchema,
  registrarBodySchema,
  verificarEmailParamSchema,
  reenviarBodySchema,
  verificarSlugParamSchema
};

