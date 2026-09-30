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

// 1. Resolve MongoDB URL for Cloud / Railway
let rawMongo = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGO_PRIVATE_URL;
if (rawMongo && (rawMongo.startsWith('${{') || rawMongo.includes('${{'))) {
  rawMongo = undefined;
}
if (!rawMongo && (process.env.MONGOHOST || process.env.MONGO_HOST)) {
  const host = process.env.MONGOHOST || process.env.MONGO_HOST;
  const port = process.env.MONGOPORT || process.env.MONGO_PORT || '27017';
  const user = process.env.MONGOUSER || process.env.MONGO_USER || process.env.MONGO_INITDB_ROOT_USERNAME;
  const pass = process.env.MONGOPASSWORD || process.env.MONGO_PASSWORD || process.env.MONGO_INITDB_ROOT_PASSWORD;
  if (user && pass) {
    rawMongo = `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/hvac_erp?authSource=admin`;
  } else {
    rawMongo = `mongodb://${host}:${port}/hvac_erp`;
  }
}

let resolvedMongo = rawMongo;
if (rawMongo) {
  let normalized = rawMongo.trim();
  const match = normalized.match(/^(mongodb(?:\+srv)?:\/\/[^\/?#]+)(\/?[^?#]*)(\?.*)?$/i);
  if (match) {
    const base = match[1];
    let path = match[2];
    let query = match[3] || '';
    if (!path || path === '/') {
      path = '/hvac_erp';
    }
    const hasCredentials = /:\/\/[^@]+@/.test(base);
    if (hasCredentials && !query.includes('authSource=')) {
      query = query ? `${query}&authSource=admin` : '?authSource=admin';
    }
    normalized = `${base}${path}${query}`;
  }
  resolvedMongo = normalized;
}

// 2. Resolve Redis URL
let rawRedis = process.env.REDIS_URI || process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL;
if (rawRedis && (rawRedis.startsWith('${{') || rawRedis.includes('${{'))) {
  rawRedis = undefined;
}
if (!rawRedis && (process.env.REDISHOST || process.env.REDIS_HOST)) {
  const host = process.env.REDISHOST || process.env.REDIS_HOST;
  const port = process.env.REDISPORT || process.env.REDIS_PORT || '6379';
  const user = process.env.REDISUSER || process.env.REDIS_USER || 'default';
  const pass = process.env.REDISPASSWORD || process.env.REDIS_PASSWORD;
  if (pass) {
    rawRedis = `redis://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}`;
  } else {
    rawRedis = `redis://${host}:${port}`;
  }
}
const resolvedRedis = (rawRedis || '').trim();

// 3. Resolve RabbitMQ URL
let rawRabbit = process.env.RABBITMQ_URL || process.env.RABBITMQ_PRIVATE_URL;
if (rawRabbit && (rawRabbit.startsWith('${{') || rawRabbit.includes('${{'))) {
  rawRabbit = undefined;
}
if (!rawRabbit && (process.env.RABBITMQHOST || process.env.RABBITMQ_HOST)) {
  const host = process.env.RABBITMQHOST || process.env.RABBITMQ_HOST;
  const port = process.env.RABBITMQPORT || process.env.RABBITMQ_PORT || '5672';
  const user = process.env.RABBITMQUSER || process.env.RABBITMQ_USER || process.env.RABBITMQ_DEFAULT_USER || 'guest';
  const pass = process.env.RABBITMQPASSWORD || process.env.RABBITMQ_PASSWORD || process.env.RABBITMQ_DEFAULT_PASS || 'guest';
  rawRabbit = `amqp://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}`;
}
const resolvedRabbit = (rawRabbit || '').trim();

if (resolvedMongo) {
  const masked = resolvedMongo.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
  console.log(`${BOLD}Detected MongoDB URL:${RESET} ${masked}`);
}

function spawnService(service) {
  const serviceDir = path.resolve(rootDir, service.path);
  const prefix = `${service.color}[${service.name}]${RESET} `;

  const command = isDev ? (process.platform === 'win32' ? 'npx.cmd' : 'npx') : 'node';
  const args = isDev
    ? ['tsx', 'watch', 'src/server.ts']
    : ['--max-old-space-size=80', 'dist/server.js'];

  const env = {
    ...process.env,
    PORT: service.name === 'api-gateway' && process.env.PORT ? process.env.PORT : String(service.port),
    ...(resolvedMongo ? { MONGO_URI: resolvedMongo, MONGO_URL: resolvedMongo } : {}),
    ...(resolvedRedis ? { REDIS_URI: resolvedRedis, REDIS_URL: resolvedRedis } : {}),
    ...(resolvedRabbit ? { RABBITMQ_URL: resolvedRabbit } : {}),
  };

  const proc = spawn(command, args, {
    cwd: serviceDir,
    env,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: isDev && process.platform === 'win32',
  });

  const childIndex = children.findIndex((c) => c.name === service.name);
  if (childIndex >= 0) {
    children[childIndex] = { proc, name: service.name };
  } else {
    children.push({ proc, name: service.name });
  }

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

  proc.on('exit', (code, signal) => {
    if (!isTerminating) {
      console.error(`${prefix}Exited with code ${code}, signal: ${signal}. Restarting in 2s...`);
      setTimeout(() => spawnService(service), 2000);
    }
  });
}

// Staggered boot sequence (250ms interval) to prevent connection storms
let delay = 0;
for (const service of SERVICES) {
  setTimeout(() => spawnService(service), delay);
  delay += 250;
}

console.log(`${BOLD}${GREEN}✔ All 14 microservices spawned successfully.${RESET}`);
console.log(`${BOLD}Main Gateway URL:${RESET} http://localhost:3000\n`);
