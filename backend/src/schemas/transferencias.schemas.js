const { z } = require('zod');
const { idParamSchema, positiveIntSchema } = require('./common.schemas');

const transferStatusSchema = z.enum(['PENDIENTE', 'MATCHED', 'MANUAL', 'RECHAZADA']);

const dateStringSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Fecha invalida');

const transferenciasQuerySchema = z.object({
  estado: transferStatusSchema.optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  desde: dateStringSchema.optional(),
  hasta: dateStringSchema.optional()
}).strip();

const transferenciaIdParamSchema = idParamSchema.strip();

const matchTransferBodySchema = z.object({
  pedidoId: positiveIntSchema
}).strip();

const rejectTransferBodySchema = z.object({
  motivo: z.string().trim().min(1).max(300).optional()
}).strip();

module.exports = {
  transferenciasQuerySchema,
  transferenciaIdParamSchema,
  matchTransferBodySchema,
  rejectTransferBodySchema
};
