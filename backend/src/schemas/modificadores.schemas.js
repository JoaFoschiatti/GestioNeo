const { z } = require('zod');
const { booleanOptionalFromString, positiveIntSchema, idParamSchema } = require('./common.schemas');

const tipoModificadorSchema = z.enum(['EXCLUSION', 'ADICION']);

const productoIdParamSchema = z.object({
  productoId: positiveIntSchema
});

const listarQuerySchema = z.object({
  activo: booleanOptionalFromString,
  tipo: tipoModificadorSchema.optional()
}).strip();

const precioCreateSchema = z.preprocess((val) => {
  if (val === undefined || val === null || val === '') return undefined;
  return val;
}, z.coerce.number().min(0));

const precioUpdateSchema = z.preprocess((val) => {
  if (val === undefined || val === null || val === '') return undefined;
  return val;
}, z.coerce.number().min(0).optional());

const crearModificadorBodySchema = z.object({
  nombre: z.string({ required_error: 'Nombre es requerido' }).min(1, 'Nombre es requerido'),
  tipo: tipoModificadorSchema,
  precio: precioCreateSchema.optional()
}).strip();

const actualizarModificadorBodySchema = z.object({
  nombre: z.string().min(1).optional(),
  tipo: tipoModificadorSchema.optional(),
  precio: precioUpdateSchema,
  activo: booleanOptionalFromString
}).strip();

const asignarAProductoBodySchema = z.object({
  modificadorIds: z.array(z.coerce.number().int().positive()).optional()
}).strip();

module.exports = {
  tipoModificadorSchema,
  idParamSchema,
  productoIdParamSchema,
  listarQuerySchema,
  crearModificadorBodySchema,
  actualizarModificadorBodySchema,
  asignarAProductoBodySchema
};
