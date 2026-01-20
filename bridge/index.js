const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const API_BASE_URL = process.env.BRIDGE_API_URL || 'http://localhost:3001/api';
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN;
const BRIDGE_ID = process.env.BRIDGE_ID || os.hostname();
const PRINTER_NAME = process.env.PRINTER_NAME;
const pollIntervalRaw = parseInt(process.env.POLL_INTERVAL_MS || '2000', 10);
const POLL_INTERVAL_MS = Number.isNaN(pollIntervalRaw) ? 2000 : pollIntervalRaw;
const ADAPTER = (process.env.PRINT_ADAPTER || 'spooler').toLowerCase();

if (!BRIDGE_TOKEN) {
  console.error('BRIDGE_TOKEN is required');
  process.exit(1);
}

if (!PRINTER_NAME) {
  console.error('PRINTER_NAME is required');
  process.exit(1);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const escapePsString = (value) => String(value).replace(/'/g, "''");

const printWithSpooler = async (content) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gestioneo-print-'));
  const filePath = path.join(tmpDir, `job-${Date.now()}.txt`);
  const payload = content.replace(/\n/g, '\r\n');

  fs.writeFileSync(filePath, payload, 'utf8');

  const psPath = 'powershell.exe';
  const escapedFile = escapePsString(filePath);
  const escapedPrinter = escapePsString(PRINTER_NAME);
  const command = `Get-Content -Path '${escapedFile}' | Out-Printer -Name '${escapedPrinter}'`;

  await new Promise((resolve, reject) => {
    const child = spawn(psPath, ['-NoProfile', '-Command', command], {
      stdio: 'inherit'
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) return resolve();
      return reject(new Error(`PowerShell exit code ${code}`));
    });
  });

  fs.rmSync(tmpDir, { recursive: true, force: true });
};

const claimJobs = async () => {
  const response = await fetch(`${API_BASE_URL}/impresion/jobs/claim`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bridge-token': BRIDGE_TOKEN
    },
    body: JSON.stringify({
      bridgeId: BRIDGE_ID,
      limit: 3,
      printerName: PRINTER_NAME,
      adapter: ADAPTER
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Claim failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  return data.jobs || [];
};

const ackJob = async (jobId) => {
  await fetch(`${API_BASE_URL}/impresion/jobs/${jobId}/ack`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bridge-token': BRIDGE_TOKEN
    },
    body: JSON.stringify({ bridgeId: BRIDGE_ID })
  });
};

const failJob = async (jobId, error) => {
  await fetch(`${API_BASE_URL}/impresion/jobs/${jobId}/fail`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bridge-token': BRIDGE_TOKEN
    },
    body: JSON.stringify({ bridgeId: BRIDGE_ID, error })
  });
};

const processJob = async (job) => {
  if (ADAPTER !== 'spooler') {
    throw new Error(`Unsupported adapter: ${ADAPTER}`);
  }

  await printWithSpooler(job.contenido);
};

const loop = async () => {
  while (true) {
    try {
      const jobs = await claimJobs();

      if (jobs.length === 0) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      for (const job of jobs) {
        try {
          await processJob(job);
          await ackJob(job.id);
          console.log(`Printed job ${job.id} (${job.tipo})`);
        } catch (error) {
          console.error(`Failed job ${job.id}:`, error.message || error);
          await failJob(job.id, error.message || 'Print error');
        }
      }
    } catch (error) {
      console.error('Bridge loop error:', error.message || error);
      await sleep(POLL_INTERVAL_MS);
    }
  }
};

loop();
