#!/usr/bin/env node
/**
 * HVAC ERP Microservices - Master Process Orchestrator
 * Spawns and manages all 14 backend microservices and API Gateway concurrently.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

try {
  process.loadEnvFile(path.resolve(rootDir, '.env'));
} catch (e) {
  // .env file is optional if env vars are already set in environment
}

const isDev = process.argv.includes('--dev');

const SERVICES = [
  { name: 'api-gateway', path: 'apps/api-gateway', port: 3000, color: '\x1b[36m' },
  { name: 'identity-service', path: 'apps/identity-service', port: 4001, color: '\x1b[32m' },
  { name: 'inventory-service', path: 'apps/inventory-service', port: 4002, color: '\x1b[33m' },
  { name: 'purchasing-service', path: 'apps/purchasing-service', port: 4003, color: '\x1b[34m' },
  { name: 'customer-service', path: 'apps/customer-service', port: 4004, color: '\x1b[35m' },
  { name: 'sales-service', path: 'apps/sales-service', port: 4005, color: '\x1b[36m' },
  { name: 'installment-service', path: 'apps/installment-service', port: 4006, color: '\x1b[32m' },
  { name: 'finance-service', path: 'apps/finance-service', port: 4007, color: '\x1b[33m' },
  { name: 'technician-service', path: 'apps/technician-service', port: 4008, color: '\x1b[34m' },
  { name: 'service-operations-service', path: 'apps/service-operations-service', port: 4009, color: '\x1b[35m' },
  { name: 'approval-service', path: 'apps/approval-service', port: 4010, color: '\x1b[36m' },
  { name: 'notification-service', path: 'apps/notification-service', port: 4011, color: '\x1b[32m' },
  { name: 'audit-service', path: 'apps/audit-service', port: 4012, color: '\x1b[33m' },
  { name: 'reporting-service', path: 'apps/reporting-service', port: 4013, color: '\x1b[34m' },
];

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';

console.log(`\n${BOLD}${GREEN}======================================================================${RESET}`);
console.log(`${BOLD}  🚀 Starting HVAC ERP Backend System (${isDev ? 'Development/Watch' : 'Compiled Production'})${RESET}`);
console.log(`${BOLD}${GREEN}======================================================================${RESET}\n`);

console.log(`${BOLD}Port Mapping & Service Architecture:${RESET}`);
console.table(
  SERVICES.map((s) => ({
    Service: s.name,
    Port: s.port,
    URL: `http://localhost:${s.port}`,
    Health: `http://localhost:${s.port}/health`,
  }))
);

const children = [];
let isTerminating = false;

function shutdownAll(signal) {
  if (isTerminating) return;
  isTerminating = true;
  console.log(`\n${BOLD}Received ${signal}. Gracefully stopping all 14 services...${RESET}`);

  for (const { proc, name } of children) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', proc.pid.toString(), '/f', '/t']);
      } else {
        proc.kill('SIGTERM');
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  setTimeout(() => {
    console.log(`${BOLD}${GREEN}All microservices stopped cleanly.${RESET}`);
    process.exit(0);
  }, 1000);
}

process.on('SIGINT', () => shutdownAll('SIGINT'));
process.on('SIGTERM', () => shutdownAll('SIGTERM'));

for (const service of SERVICES) {
  const serviceDir = path.resolve(rootDir, service.path);
  const prefix = `${service.color}[${service.name}]${RESET} `;

  const command = isDev ? (process.platform === 'win32' ? 'npx.cmd' : 'npx') : 'node';
  const args = isDev ? ['tsx', 'watch', 'src/server.ts'] : ['dist/server.js'];

  const env = {
    ...process.env,
    PORT: service.name === 'api-gateway' && process.env.PORT ? process.env.PORT : String(service.port),
  };

  const proc = spawn(command, args, {
    cwd: serviceDir,
    env,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: isDev && process.platform === 'win32',
  });

  children.push({ proc, name: service.name });

  proc.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        console.log(`${prefix}${line}`);
      }
    }
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        console.error(`${prefix}\x1b[31m${line}${RESET}`);
      }
    }
  });

  proc.on('exit', (code) => {
    if (!isTerminating && code !== 0) {
      console.error(`${prefix}Exited with code ${code}`);
    }
  });
}

console.log(`${BOLD}${GREEN}✔ All 14 microservices spawned successfully.${RESET}`);
console.log(`${BOLD}Main Gateway URL:${RESET} http://localhost:3000\n`);
