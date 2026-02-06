const http = require('http');
const app = require('../app');
const eventBus = require('../services/event-bus');
const {
  prisma,
  uniqueId,
  createTenant,
  createUsuario,
  signTokenForUser,
  cleanupTenantData
} = require('./helpers/test-helpers');

describe('Eventos SSE', () => {
  let tenant;
  let otherTenant;
  let token;

  beforeAll(async () => {
    tenant = await createTenant();
    otherTenant = await createTenant();
    const admin = await createUsuario(tenant.id, {
      email: `${uniqueId('admin')}@example.com`,
      rol: 'ADMIN'
    });
    token = signTokenForUser(admin, { payload: { purpose: 'sse' }, expiresIn: '30s' });
  });

  afterAll(async () => {
    await cleanupTenantData(tenant.id);
    await cleanupTenantData(otherTenant.id);
    await prisma.$disconnect();
  });

  it('solo emite eventos del mismo tenant (requiere tenantId en payload)', async () => {
    const server = app.listen(0);

    try {
      const port = server.address().port;

      const received = await new Promise((resolve, reject) => {
        const req = http.request({
          method: 'GET',
          host: '127.0.0.1',
          port,
          path: `/api/eventos?token=${encodeURIComponent(token)}`,
          headers: {
            Accept: 'text/event-stream'
          }
        }, (res) => {
          try {
            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toMatch(/text\/event-stream/);
          } catch (assertError) {
            res.destroy();
            req.destroy();
            reject(assertError);
            return;
          }

          let buffer = '';

          const timeoutId = setTimeout(() => {
            res.destroy();
            req.destroy();
            reject(new Error('No se recibió evento SSE a tiempo'));
          }, 1500);

          const cleanup = () => {
            clearTimeout(timeoutId);
            res.removeAllListeners('data');
          };

          res.on('data', (chunk) => {
            buffer += chunk.toString('utf8');

            const messages = buffer.split('\n\n');
            buffer = messages.pop() || '';

            for (const msg of messages) {
              if (msg.startsWith(':')) continue; // keep-alive

              const lines = msg.split('\n').filter(Boolean);
              const eventLine = lines.find(l => l.startsWith('event:'));
              const dataLine = lines.find(l => l.startsWith('data:'));

              if (!eventLine || !dataLine) continue;

              const eventType = eventLine.replace(/^event:\s*/, '');
              const dataRaw = dataLine.replace(/^data:\s*/, '');

              cleanup();
              res.destroy();
              req.destroy();
              resolve({ eventType, data: JSON.parse(dataRaw) });
              return;
            }
          });

          setImmediate(() => {
            eventBus.publish('test.other', { tenantId: otherTenant.id, ok: false });
            eventBus.publish('test.noTenant', { ok: false });
            eventBus.publish('test.ok', { tenantId: tenant.id, ok: true });
          });
        });

        req.on('error', reject);
        req.end();
      });

      expect(received.eventType).toBe('test.ok');
      expect(received.data).toEqual({ tenantId: tenant.id, ok: true });
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });
});

