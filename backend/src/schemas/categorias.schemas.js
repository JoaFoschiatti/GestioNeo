const { z } = require('zod');
const { booleanOptionalFromString, idParamSchema } = require('./common.schemas');

const listarQuerySchema = z.object({
  activa: booleanOptionalFromString
}).strip();

const crearCategoriaBodySchema = z.object({
  nombre: z.string({ required_error: 'Nombre es requerido' }).min(1, 'Nombre es requerido'),
  descripcion: z.string().optional(),
  orden: z.coerce.number().int().optional()
}).strip();

const actualizarCategoriaBodySchema = z.object({
  nombre: z.string().min(1).optional(),
  descripcion: z.string().optional(),
  orden: z.coerce.number().int().optional(),
  activa: booleanOptionalFromString
}).strip();

module.exports = {
  idParamSchema,
  listarQuerySchema,
  crearCategoriaBodySchema,
  actualizarCategoriaBodySchema
};
