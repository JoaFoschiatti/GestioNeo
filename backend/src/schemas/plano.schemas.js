const { z } = require('zod');

const zonaPlanoSchema = z.enum(['Interior', 'Exterior']);

const paredSchema = z.object({
  id: z.string().min(1).max(50),
  x1: z.number().int().min(0).max(2000),
  y1: z.number().int().min(0).max(2000),
  x2: z.number().int().min(0).max(2000),
  y2: z.number().int().min(0).max(2000),
  grosor: z.number().int().min(4).max(20).default(8)
});

const obtenerParedesQuerySchema = z.object({
  zona: zonaPlanoSchema
}).strip();

const guardarParedesBodySchema = z.object({
  zona: zonaPlanoSchema,
  paredes: z.array(paredSchema).max(100)
}).strip();

module.exports = {
  obtenerParedesQuerySchema,
  guardarParedesBodySchema
};
