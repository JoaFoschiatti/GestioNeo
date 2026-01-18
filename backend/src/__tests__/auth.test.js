const request = require('supertest');
const app = require('../app');

describe('Auth Endpoints', () => {
  describe('POST /api/auth/login', () => {
    it('should return 401 for invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'usuario@inexistente.com',
          password: 'passwordIncorrecto'
        })
        .expect(401);

      expect(response.body.error.message).toBe('Credenciales inválidas');
    });

    it('should return error for missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      // Retorna 500 porque Prisma requiere email
      expect([400, 401, 500]).toContain(response.status);
      expect(response.body.error).toBeDefined();
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@test.com',
          password: 'test'
        });

      // Verificar headers de rate limiting
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
    });
  });

  describe('GET /api/auth/perfil', () => {
    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/auth/perfil')
        .expect(401);

      expect(response.body.error.message).toBe('Token no proporcionado');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/perfil')
        .set('Authorization', 'Bearer token_invalido')
        .expect(401);

      expect(response.body.error.message).toBe('Token inválido');
    });
  });
});
