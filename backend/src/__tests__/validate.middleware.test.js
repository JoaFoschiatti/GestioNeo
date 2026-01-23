const { z } = require('zod');
const { validate } = require('../middlewares/validate.middleware');

describe('validate.middleware', () => {
  it('coacciona params, query y body y los sobrescribe en req', () => {
    const req = {
      params: { id: '123' },
      query: { page: '2' },
      body: { count: '5' }
    };
    const res = {};
    const next = jest.fn();

    const middleware = validate({
      params: z.object({ id: z.coerce.number().int() }),
      query: z.object({ page: z.coerce.number().int() }),
      body: z.object({ count: z.coerce.number().int() })
    });

    middleware(req, res, next);

    expect(req.params.id).toBe(123);
    expect(req.query.page).toBe(2);
    expect(req.body.count).toBe(5);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('devuelve error 400 con detalles de Zod', () => {
    const req = { body: {} };
    const res = {};
    const next = jest.fn();

    const middleware = validate({
      body: z.object({ nombre: z.string().min(1) })
    });

    middleware(req, res, next);

    const error = next.mock.calls[0][0];
    expect(error.status).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'nombre' })
    ]));
  });
});
