const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { createBridge } = require('../bridge');

describe('bridge', () => {
  it('start imprime errores y termina si faltan envs', () => {
    const originalExit = process.exit;
    const originalError = console.error;
    const exitCalls = [];
    const errorCalls = [];
    const exitError = new Error('exit');

    process.exit = (code) => {
      exitCalls.push(code);
      throw exitError;
    };
    console.error = (...args) => {
      errorCalls.push(args.join(' '));
    };

    const bridge = createBridge({ BRIDGE_TOKEN: 'token' }, {
      fetch: async () => ({ ok: true, json: async () => ({ jobs: [] }) })
    });

    let caughtError = null;
    try {
      bridge.start();
    } catch (error) {
      caughtError = error;
    }

    assert.equal(caughtError, exitError);
    assert.ok(errorCalls.includes('BRIDGE_TENANT_SLUG is required'));
    assert.ok(errorCalls.includes('PRINTER_NAME is required'));
    assert.equal(exitCalls[0], 1);

    process.exit = originalExit;
    console.error = originalError;
  });
  it('enforce minimo del intervalo de polling', () => {
    const bridge = createBridge({
      BRIDGE_TOKEN: 'token',
      BRIDGE_TENANT_SLUG: 'demo',
      PRINTER_NAME: 'Printer',
      POLL_INTERVAL_MS: '10'
    }, {
      fetch: async () => ({ ok: true, json: async () => ({ jobs: [] }) })
    });

    assert.equal(bridge.config.pollIntervalMs, 500);
  });

  it('normaliza adapter y usa api base por defecto', () => {
    const bridge = createBridge({
      BRIDGE_TOKEN: 'token',
      BRIDGE_TENANT_SLUG: 'demo',
      PRINTER_NAME: 'Printer',
      PRINT_ADAPTER: 'SPOOLER'
    }, {
      fetch: async () => ({ ok: true, json: async () => ({ jobs: [] }) })
    });

    assert.equal(bridge.config.adapter, 'spooler');
    assert.equal(bridge.config.apiBaseUrl, 'http://localhost:3001/api');
  });

  it('requestJson propaga error cuando la respuesta no es ok', async () => {
    const bridge = createBridge({
      BRIDGE_TOKEN: 'token',
      BRIDGE_TENANT_SLUG: 'demo',
      PRINTER_NAME: 'Printer',
      REQUEST_TIMEOUT_MS: '100'
    }, {
      fetch: async () => ({
        ok: false,
        status: 500,
        text: async () => 'boom'
      })
    });

    await assert.rejects(
      () => bridge.requestJson('http://localhost', {}, 'Claim failed'),
      /Claim failed: 500 boom/
    );
  });

  it('requestJson respeta timeout', async () => {
    const bridge = createBridge({
      BRIDGE_TOKEN: 'token',
      BRIDGE_TENANT_SLUG: 'demo',
      PRINTER_NAME: 'Printer',
      REQUEST_TIMEOUT_MS: '5'
    }, {
      fetch: (_url, options) => new Promise((_, reject) => {
        options.signal.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      })
    });

    await assert.rejects(
      () => bridge.requestJson('http://localhost', {}, 'Claim failed'),
      /timeout after 5ms/
    );
  });

  it('processJob falla si el adapter no esta soportado', async () => {
    const bridge = createBridge({
      BRIDGE_TOKEN: 'token',
      BRIDGE_TENANT_SLUG: 'demo',
      PRINTER_NAME: 'Printer',
      PRINT_ADAPTER: 'raw'
    }, {
      fetch: async () => ({ ok: true, json: async () => ({ jobs: [] }) })
    });

    await assert.rejects(
      () => bridge.processJob({ contenido: 'test' }),
      /Unsupported adapter: raw/
    );
  });
});
