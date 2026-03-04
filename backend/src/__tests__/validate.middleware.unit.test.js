const { z } = require('zod');
const { validate } = require('../middlewares/validate.middleware');

describe('validate middleware', () => {
  it('sobrescribe params y body con valores parseados', () => {
    const middleware = validate({
      params: z.object({ id: z.coerce.number().int() }),
      body: z.object({ nombre: z.string() })
    });

    const req = { params: { id: '5', extra: 'x' }, body: { nombre: 'Ana', extra: true } };
    const next = jest.fn();

    middleware(req, {}, next);

    expect(req.params).toEqual({ id: 5 });
    expect(req.body).toEqual({ nombre: 'Ana' });
    expect(next).toHaveBeenCalled();
  });

  it('reescribe req.query con defineProperty', () => {
    const middleware = validate({
      query: z.object({ page: z.coerce.number().default(1) })
    });

    const req = { query: { page: '2' } };
    const next = jest.fn();

    middleware(req, {}, next);

    expect(req.query).toEqual({ page: 2 });
    expect(next).toHaveBeenCalled();
  });

  it('devuelve error 400 con detalles si falla la validacion', () => {
    const middleware = validate({
      body: z.object({ amount: z.number().min(1) })
    });

    const req = { body: { amount: 'no' } };
    const next = jest.fn();

    middleware(req, {}, next);

    const error = next.mock.calls[0][0];
    expect(error.status).toBe(400);
    expect(error.message).toBe('Datos inválidos');
    expect(error.details[0]).toEqual(expect.objectContaining({ path: 'amount' }));
  });
});
