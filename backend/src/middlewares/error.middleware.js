const { Prisma } = require('@prisma/client');
const multer = require('multer');
const { HttpError, createHttpError } = require('../utils/http-error');

const isPrismaKnownError = (error) => error instanceof Prisma.PrismaClientKnownRequestError;
const isPrismaValidationError = (error) => error instanceof Prisma.PrismaClientValidationError;
const isMulterError = (error) => error instanceof multer.MulterError || error?.name === 'MulterError';

const prismaErrorToHttpError = (error) => {
  if (!isPrismaKnownError(error)) return null;

  if (error.code === 'P2002') {
    const target = Array.isArray(error.meta?.target) ? error.meta.target.join(', ') : error.meta?.target;
    return createHttpError.conflict('Violación de unicidad', target ? { target } : undefined);
  }

  if (error.code === 'P2003') {
    return createHttpError.conflict('Violación de clave foránea');
  }

  if (error.code === 'P2025') {
    return createHttpError.notFound('Registro no encontrado');
  }

  return null;
};

const multerErrorToHttpError = (error) => {
  if (!isMulterError(error)) return null;

  if (error.code === 'LIMIT_FILE_SIZE') {
    return createHttpError.badRequest('El archivo excede el tamaño máximo permitido', { multerCode: error.code });
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return createHttpError.badRequest('Archivo inesperado', { multerCode: error.code, field: error.field });
  }

  return createHttpError.badRequest('Error al subir archivo', { multerCode: error.code });
};

const errorMiddleware = (error, _req, res, _next) => {
  const isDev = process.env.NODE_ENV === 'development';

  let normalizedError = error;

  const mappedPrismaError = prismaErrorToHttpError(error);
  const mappedMulterError = multerErrorToHttpError(error);

  if (mappedPrismaError) {
    normalizedError = mappedPrismaError;
  } else if (mappedMulterError) {
    normalizedError = mappedMulterError;
  } else if (isPrismaValidationError(error)) {
    normalizedError = createHttpError.badRequest('Datos inválidos');
  }

  const status = normalizedError instanceof HttpError ? normalizedError.status : (normalizedError.status || 500);
  const message = normalizedError instanceof HttpError
    ? normalizedError.message
    : (status >= 500 ? 'Error interno del servidor' : (normalizedError.message || 'Error'));

  const payload = {
    error: {
      message,
      ...(normalizedError.code ? { code: normalizedError.code } : {}),
      ...(normalizedError.details ? { details: normalizedError.details } : {}),
      ...(isDev ? { stack: normalizedError.stack } : {})
    }
  };

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(normalizedError);
  }

  res.status(status).json(payload);
};

module.exports = { errorMiddleware };
