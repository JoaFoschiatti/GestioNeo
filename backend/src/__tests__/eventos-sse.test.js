const http = require('http');
const app = require('../app');
const eventBus = require('../services/event-bus');
const {
  prisma,
  uniqueId,
  createUsuario,
  signTokenForUser,
  cleanupTestData,
  ensureActiveSuscripcion
} = require('./helpers/test-helpers');

describe('Eventos SSE', () => {
  let token;

  beforeAll(async () => {
    await cleanupTestData();
    await ensureActiveSuscripcion();
    const admin = await createUsuario({
      email: `${uniqueId('admin')}@example.com`,
      rol: 'ADMIN'
    });
    token = signTokenForUser(admin, { payload: { purpose: 'sse' }, expiresIn: '30s' });
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it('emite eventos SSE al cliente conectado', async () => {
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
            eventBus.publish('test.ok', { ok: true });
          });
        });

        req.on('error', reject);
        req.end();
      });

      expect(received.eventType).toBe('test.ok');
      expect(received.data).toEqual({ ok: true });
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });
});
