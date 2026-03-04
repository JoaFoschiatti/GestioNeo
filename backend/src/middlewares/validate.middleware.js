const { ZodError } = require('zod');
const { createHttpError } = require('../utils/http-error');

const overwriteObject = (target, source) => {
  if (!target || typeof target !== 'object') return;
  Object.keys(target).forEach((key) => delete target[key]);
  Object.assign(target, source);
};

const formatZodError = (error) => {
  if (!(error instanceof ZodError)) return null;

  return error.issues.map(issue => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
    code: issue.code
  }));
};

const validate = (schemas = {}) => {
  return (req, _res, next) => {
    try {
      if (schemas.params) {
        const parsedParams = schemas.params.parse(req.params);
        if (req.params && typeof req.params === 'object') {
          overwriteObject(req.params, parsedParams);
        } else {
          req.params = parsedParams;
        }
      }

      if (schemas.query) {
        const parsedQuery = schemas.query.parse(req.query);
        // In Express, req.query is a getter without a setter.
        // Overwrite it with a data property so downstream code sees parsed values.
        Object.defineProperty(req, 'query', {
          value: parsedQuery,
          writable: true,
          configurable: true,
          enumerable: true
        });
      }

      if (schemas.body) {
        const parsedBody = schemas.body.parse(req.body);
        if (req.body && typeof req.body === 'object') {
          overwriteObject(req.body, parsedBody);
        } else {
          req.body = parsedBody;
        }
      }

      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(createHttpError.badRequest('Datos inválidos', formatZodError(error)));
      }

      return next(error);
    }
  };
};

module.exports = { validate };
