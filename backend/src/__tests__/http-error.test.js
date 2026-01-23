const { HttpError, createHttpError } = require('../utils/http-error');

describe('HttpError', () => {
  it('construye errores con status, code y detalles', () => {
    const error = new HttpError(400, 'Mensaje', { code: 'BAD', details: { field: 'x' } });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('HttpError');
    expect(error.status).toBe(400);
    expect(error.code).toBe('BAD');
    expect(error.details).toEqual({ field: 'x' });
  });

  it('createHttpError.badRequest usa valores por defecto', () => {
    const error = createHttpError.badRequest();

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(400);
    expect(error.message).toBe('Solicitud inválida');
    expect(error.code).toBe('BAD_REQUEST');
  });

  it('createHttpError.internal acepta detalles', () => {
    const error = createHttpError.internal('Fallo', { traceId: 'abc' });

    expect(error.status).toBe(500);
    expect(error.message).toBe('Fallo');
    expect(error.code).toBe('INTERNAL');
    expect(error.details).toEqual({ traceId: 'abc' });
  });
});
