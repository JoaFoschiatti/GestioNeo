const { z } = require('zod');
const { booleanOptionalFromString, positiveIntSchema, idParamSchema } = require('./common.schemas');

const booleanFromString = (defaultValue) => z.preprocess((val) => {
  if (val === undefined) return defaultValue;
  if (val === true || val === 'true') return true;
  if (val === false || val === 'false') return false;
  return val;
}, z.boolean());

const listarQuerySchema = z.object({
  categoriaId: positiveIntSchema.optional(),
  disponible: booleanOptionalFromString
}).strip();

const ingredienteInputSchema = z.object({
  ingredienteId: positiveIntSchema,
  cantidad: z.coerce.number().positive()
}).strip();

const ingredientesSchema = z.preprocess((val) => {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}, z.array(ingredienteInputSchema));

const crearProductoBodySchema = z.object({
  nombre: z.string({ required_error: 'Nombre es requerido' }).min(1, 'Nombre es requerido'),
  descripcion: z.string().optional(),
  precio: z.coerce.number().positive(),
  categoriaId: positiveIntSchema,
  disponible: booleanFromString(true),
  destacado: booleanFromString(false),
  ingredientes: ingredientesSchema.optional()
}).strip();

const actualizarProductoBodySchema = z.object({
  nombre: z.string().min(1).optional(),
  descripcion: z.string().optional(),
  precio: z.coerce.number().positive().optional(),
  categoriaId: positiveIntSchema.optional(),
  disponible: booleanOptionalFromString,
  destacado: booleanOptionalFromString,
  ingredientes: ingredientesSchema.optional()
}).strip();

const cambiarDisponibilidadBodySchema = z.object({
  disponible: z.boolean()
}).strip();

const crearVarianteBodySchema = z.object({
  nombreVariante: z.string({ required_error: 'Nombre de variante es requerido' }).min(1),
  precio: z.coerce.number().positive(),
  multiplicadorInsumos: z.coerce.number().positive().optional(),
  ordenVariante: z.coerce.number().int().optional(),
  esVariantePredeterminada: z.boolean().optional(),
  descripcion: z.string().optional()
}).strip();

const actualizarVarianteBodySchema = z.object({
  nombreVariante: z.string().min(1).optional(),
  precio: z.coerce.number().positive().optional(),
  multiplicadorInsumos: z.coerce.number().positive().optional(),
  ordenVariante: z.coerce.number().int().optional(),
  esVariantePredeterminada: z.boolean().optional(),
  descripcion: z.string().optional(),
  disponible: z.boolean().optional()
}).strip();

const agruparVariantesBodySchema = z.object({
  productoBaseId: positiveIntSchema,
  variantes: z.array(z.object({
    productoId: positiveIntSchema,
    nombreVariante: z.string().min(1),
    multiplicadorInsumos: z.coerce.number().positive().optional(),
    ordenVariante: z.coerce.number().int().optional(),
    esVariantePredeterminada: z.boolean().optional()
  }).strip()).min(1)
}).strip();

module.exports = {
  idParamSchema,
  listarQuerySchema,
  crearProductoBodySchema,
  actualizarProductoBodySchema,
  cambiarDisponibilidadBodySchema,
  crearVarianteBodySchema,
  actualizarVarianteBodySchema,
  agruparVariantesBodySchema
};
