const { z } = require('zod');

const positiveInt = z.coerce.number().int().positive();

const emitirComprobanteBodySchema = z.object({
  pedidoId: positiveInt,
  pagoId: positiveInt.optional(),
  tipoComprobante: z.enum(['FACTURA_A', 'FACTURA_B', 'FACTURA_C']),
  docTipo: z.coerce.number().int().min(0).max(99),
  docNro: z.string().max(20),
  clienteNombre: z.string().max(200).optional()
}).strip();

const consumidorFinalBodySchema = z.object({
  pedidoId: positiveInt,
  pagoId: positiveInt.optional()
}).strip();

const listarComprobantesQuerySchema = z.object({
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
  tipoComprobante: z.enum([
    'FACTURA_A', 'FACTURA_B', 'FACTURA_C',
    'NOTA_CREDITO_A', 'NOTA_CREDITO_B', 'NOTA_CREDITO_C',
    'NOTA_DEBITO_A', 'NOTA_DEBITO_B', 'NOTA_DEBITO_C'
  ]).optional(),
  estado: z.enum(['PENDIENTE', 'AUTORIZADO', 'RECHAZADO', 'ERROR']).optional(),
  pedidoId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
}).strip();

const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

const pedidoIdParamSchema = z.object({
  pedidoId: z.coerce.number().int().positive()
});

module.exports = {
  emitirComprobanteBodySchema,
  consumidorFinalBodySchema,
  listarComprobantesQuerySchema,
  idParamSchema,
  pedidoIdParamSchema
};
