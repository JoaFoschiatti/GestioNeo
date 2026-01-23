const { z } = require('zod');

const loginBodySchema = z.object({
  email: z.string({ required_error: 'Email es requerido' }).min(1, 'Email es requerido').email('Email inválido'),
  password: z.string({ required_error: 'Password es requerido' }).min(1, 'Password es requerido'),
  slug: z.string().min(1, 'Slug inválido').optional()
}).strip();

const registrarBodySchema = z.object({
  email: z.string({ required_error: 'Email es requerido' }).min(1, 'Email es requerido').email('Email inválido'),
  password: z.string({ required_error: 'Password es requerido' }).min(6, 'Password debe tener al menos 6 caracteres'),
  nombre: z.string({ required_error: 'Nombre es requerido' }).min(1, 'Nombre es requerido'),
  rol: z.enum(['ADMIN', 'MOZO', 'COCINERO', 'CAJERO', 'DELIVERY']).optional()
}).strip();

const cambiarPasswordBodySchema = z.object({
  passwordActual: z.string({ required_error: 'Password actual es requerido' }).min(1, 'Password actual es requerido'),
  passwordNuevo: z.string({ required_error: 'Password nuevo es requerido' }).min(6, 'Password nuevo debe tener al menos 6 caracteres')
}).strip();

module.exports = {
  loginBodySchema,
  registrarBodySchema,
  cambiarPasswordBodySchema
};

