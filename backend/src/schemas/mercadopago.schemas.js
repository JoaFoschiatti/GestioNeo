const { z } = require('zod');

const configManualBodySchema = z.object({
  accessToken: z.string({ required_error: 'Access Token es requerido' }).min(1, 'Access Token es requerido'),
  publicKey: z.string().min(1).optional()
}).strip();

const transaccionesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  desde: z.string().min(1).optional(),
  hasta: z.string().min(1).optional(),
  status: z.string().min(1).optional()
}).strip();

module.exports = {
  configManualBodySchema,
  transaccionesQuerySchema
};

