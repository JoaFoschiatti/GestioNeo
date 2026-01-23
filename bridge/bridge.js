const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const DEFAULT_API_BASE_URL = 'http://localhost:3001/api';
const DEFAULT_POLL_INTERVAL_MS = 2000;
const MIN_POLL_INTERVAL_MS = 500;
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const parseIntSafe = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const escapePsString = (value) => String(value).replace(/'/g, "''");

const getConfig = (env = process.env) => {
  const bridgeToken = env.BRIDGE_TOKEN;
  const tenantSlug = env.BRIDGE_TENANT_SLUG;
  const printerName = env.PRINTER_NAME;

  const missing = [];
  if (!bridgeToken) missing.push('BRIDGE_TOKEN');
  if (!tenantSlug) missing.push('BRIDGE_TENANT_SLUG');
  if (!printerName) missing.push('PRINTER_NAME');

  const pollIntervalRaw = parseIntSafe(env.POLL_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS);
  const pollIntervalMs = Math.max(pollIntervalRaw, MIN_POLL_INTERVAL_MS);
  const requestTimeoutMs = parseIntSafe(env.REQUEST_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT_MS);

  return {
    apiBaseUrl: env.BRIDGE_API_URL || DEFAULT_API_BASE_URL,
    bridgeToken,
    tenantSlug,
    bridgeId: env.BRIDGE_ID || os.hostname(),
    printerName,
    adapter: (env.PRINT_ADAPTER || 'spooler').toLowerCase(),
    pollIntervalMs,
    requestTimeoutMs,
    missing
  };
};

const requestJson = async (url, options, context, timeoutMs, fetchImpl) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const suffix = body ? ` ${body}` : '';
      throw new Error(`${context}: ${response.status}${suffix}`);
    }
    return response;
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new Error(`${context}: timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const createBridge = (env = process.env, deps = {}) => {
  const config = getConfig(env);
  const fetchImpl = deps.fetch || fetch;
  const spawnImpl = deps.spawn || spawn;

  const printWithSpooler = async (content) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gestioneo-print-'));
    const filePath = path.join(tmpDir, `job-${Date.now()}.txt`);
    const payload = content.replace(/\n/g, '\r\n');

    try {
      fs.writeFileSync(filePath, payload, 'utf8');

      const psPath = 'powershell.exe';
      const escapedFile = escapePsString(filePath);
      const escapedPrinter = escapePsString(config.printerName);
      const command = `Get-Content -Path '${escapedFile}' | Out-Printer -Name '${escapedPrinter}'`;

      await new Promise((resolve, reject) => {
        const child = spawnImpl(psPath, ['-NoProfile', '-Command', command], {
          stdio: 'inherit'
        });

        child.on('error', reject);
        child.on('exit', (code) => {
          if (code === 0) return resolve();
          return reject(new Error(`PowerShell exit code ${code}`));
        });
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  };

  const claimJobs = async () => {
    const response = await requestJson(`${config.apiBaseUrl}/impresion/jobs/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bridge-token': config.bridgeToken,
        'x-tenant-slug': config.tenantSlug
      },
      body: JSON.stringify({
        bridgeId: config.bridgeId,
        limit: 3,
        printerName: config.printerName,
        adapter: config.adapter
      })
    }, 'Claim failed', config.requestTimeoutMs, fetchImpl);

    const data = await response.json().catch(() => {
      throw new Error('Claim failed: respuesta invalida');
    });
    return data.jobs || [];
  };

  const ackJob = async (jobId) => {
    await requestJson(`${config.apiBaseUrl}/impresion/jobs/${jobId}/ack`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bridge-token': config.bridgeToken,
        'x-tenant-slug': config.tenantSlug
      },
      body: JSON.stringify({ bridgeId: config.bridgeId })
    }, 'Ack failed', config.requestTimeoutMs, fetchImpl);
  };

  const failJob = async (jobId, error) => {
    await requestJson(`${config.apiBaseUrl}/impresion/jobs/${jobId}/fail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bridge-token': config.bridgeToken,
        'x-tenant-slug': config.tenantSlug
      },
      body: JSON.stringify({ bridgeId: config.bridgeId, error })
    }, 'Fail failed', config.requestTimeoutMs, fetchImpl);
  };

  const processJob = async (job) => {
    if (config.adapter !== 'spooler') {
      throw new Error(`Unsupported adapter: ${config.adapter}`);
    }

    await printWithSpooler(job.contenido);
  };

  const loop = async () => {
    while (true) {
      try {
        const jobs = await claimJobs();

        if (jobs.length === 0) {
          await sleep(config.pollIntervalMs);
          continue;
        }

        for (const job of jobs) {
          try {
            await processJob(job);
            await ackJob(job.id);
            // eslint-disable-next-line no-console
            console.log(`Printed job ${job.id} (${job.tipo})`);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(`Failed job ${job.id}:`, error.message || error);
            await failJob(job.id, error.message || 'Print error');
          }
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Bridge loop error:', error.message || error);
        await sleep(config.pollIntervalMs);
      }
    }
  };

  const start = () => {
    if (config.missing.length) {
      config.missing.forEach((key) => {
        // eslint-disable-next-line no-console
        console.error(`${key} is required`);
      });
      process.exit(1);
    }

    loop();
  };

  return {
    config,
    claimJobs,
    ackJob,
    failJob,
    processJob,
    printWithSpooler,
    requestJson: (url, options, context) =>
      requestJson(url, options, context, config.requestTimeoutMs, fetchImpl),
    loop,
    start
  };
};

module.exports = {
  createBridge,
  getConfig
};
