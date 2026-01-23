const { z } = require('zod');

const pedidoIdParamSchema = z.object({
  pedidoId: z.coerce.number().int().positive()
});

const registrarPagoBodySchema = z.object({
  pedidoId: z.coerce.number().int().positive(),
  monto: z.coerce.number().positive(),
  metodo: z.enum(['EFECTIVO', 'MERCADOPAGO', 'TARJETA']),
  referencia: z.string().max(200).nullable().optional(),
  comprobante: z.string().max(500).nullable().optional()
}).strip();

const crearPreferenciaBodySchema = z.object({
  pedidoId: z.coerce.number().int().positive()
}).strip();

module.exports = {
  pedidoIdParamSchema,
  registrarPagoBodySchema,
  crearPreferenciaBodySchema
};

