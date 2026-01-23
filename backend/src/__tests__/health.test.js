const request = require('supertest');
const app = require('../app');
const { prisma } = require('../db/prisma');

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Health Endpoint', () => {
  it('GET /api/health should return status ok', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.timestamp).toBeDefined();
  });

  it('should include security headers', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    // Verificar que helmet está funcionando
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
  });
});

describe('404 Handler', () => {
  it('should return 404 for unknown routes', async () => {
    const response = await request(app)
      .get('/api/ruta-inexistente')
      .expect(404);

    expect(response.body.error.message).toBe('Ruta no encontrada');
  });
});
