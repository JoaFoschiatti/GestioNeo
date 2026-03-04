class HttpError extends Error {
  constructor(status, message, options = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = options.code;
    this.details = options.details;
  }
}

const createHttpError = {
  badRequest: (message = 'Solicitud inválida', details) =>
    new HttpError(400, message, { code: 'BAD_REQUEST', details }),
  unauthorized: (message = 'No autorizado', details) =>
    new HttpError(401, message, { code: 'UNAUTHORIZED', details }),
  forbidden: (message = 'Prohibido', details) =>
    new HttpError(403, message, { code: 'FORBIDDEN', details }),
  notFound: (message = 'No encontrado', details) =>
    new HttpError(404, message, { code: 'NOT_FOUND', details }),
  conflict: (message = 'Conflicto', details) =>
    new HttpError(409, message, { code: 'CONFLICT', details }),
  internal: (message = 'Error interno del servidor', details) =>
    new HttpError(500, message, { code: 'INTERNAL', details }),
  serviceUnavailable: (message = 'Servicio no disponible', details) =>
    new HttpError(503, message, { code: 'SERVICE_UNAVAILABLE', details })
};

module.exports = { HttpError, createHttpError };

