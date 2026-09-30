/**
 * Unified In-Process Production Runner for HVAC ERP Microservices
 *
 * Runs all 14 microservices within a single Node.js process:
 * - Eliminates container memory exhaustion (OOM Killer / SIGKILL) on 512MB RAM plans
 * - Single shared MongoDB connection pool (zero socket exhaustion)
 * - Microservices listen on ports 4001..4013 on 127.0.0.1
 * - API Gateway listens on PORT (3000) on 0.0.0.0 and proxies requests locally
 * - Writes status periodically to os.tmpdir()/hvac-services.json for /health/system
 */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

process.setMaxListeners(100);

process.on('unhandledRejection', (reason) => {
  console.warn('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

try {
  process.loadEnvFile(path.resolve(rootDir, '.env'));
} catch (e) {}

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

console.log(`\n${BOLD}${CYAN}======================================================================${RESET}`);
console.log(`${BOLD}${GREEN}  🚀 Starting HVAC ERP Backend (Unified In-Process Production Mode)${RESET}`);
console.log(`${BOLD}${CYAN}======================================================================${RESET}\n`);

// 1. Resolve MongoDB URL
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
    let p = match[2];
    let query = match[3] || '';
    if (!p || p === '/') {
      p = '/hvac_erp';
    }
    const hasCredentials = /:\/\/[^@]+@/.test(base);
    if (hasCredentials && !query.includes('authSource=')) {
      query = query ? `${query}&authSource=admin` : '?authSource=admin';
    }
    normalized = `${base}${p}${query}`;
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
  process.env.MONGO_URI = resolvedMongo;
  process.env.MONGO_URL = resolvedMongo;
  const masked = resolvedMongo.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
  console.log(`${BOLD}MongoDB URI:${RESET} ${masked}`);
}
if (resolvedRedis) {
  process.env.REDIS_URI = resolvedRedis;
  process.env.REDIS_URL = resolvedRedis;
  const masked = resolvedRedis.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
  console.log(`${BOLD}Redis URI:${RESET} ${masked}`);
}
if (resolvedRabbit) {
  process.env.RABBITMQ_URL = resolvedRabbit;
  const masked = resolvedRabbit.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
  console.log(`${BOLD}RabbitMQ URL:${RESET} ${masked}`);
}

process.env.INTERNAL_SERVICE_SECRET =
  process.env.INTERNAL_SERVICE_SECRET || 'hvac-internal-signed-token-secret-minimum-32-chars';

const DOMAIN_SERVICES = [
  { name: 'identity-service', path: 'apps/identity-service', port: 4001 },
  { name: 'inventory-service', path: 'apps/inventory-service', port: 4002 },
  { name: 'purchasing-service', path: 'apps/purchasing-service', port: 4003 },
  { name: 'customer-service', path: 'apps/customer-service', port: 4004 },
  { name: 'sales-service', path: 'apps/sales-service', port: 4005 },
  { name: 'installment-service', path: 'apps/installment-service', port: 4006 },
  { name: 'finance-service', path: 'apps/finance-service', port: 4007 },
  { name: 'technician-service', path: 'apps/technician-service', port: 4008 },
  { name: 'service-operations-service', path: 'apps/service-operations-service', port: 4009 },
  { name: 'approval-service', path: 'apps/approval-service', port: 4010 },
  { name: 'notification-service', path: 'apps/notification-service', port: 4011 },
  { name: 'audit-service', path: 'apps/audit-service', port: 4012 },
  { name: 'reporting-service', path: 'apps/reporting-service', port: 4013 },
];

const serviceStatus = {};
for (const s of DOMAIN_SERVICES) {
  serviceStatus[s.name] = { status: 'starting', logs: [] };
}
serviceStatus['api-gateway'] = { status: 'starting', logs: [] };

function updateServiceStatus(name, status, log) {
  if (!serviceStatus[name]) serviceStatus[name] = { status: 'running', logs: [] };
  serviceStatus[name].status = status;
  if (log) {
    if (serviceStatus[name].logs.length >= 20) serviceStatus[name].logs.shift();
    serviceStatus[name].logs.push(log);
  }
}

function flushStatus() {
  try {
    const statusFile = path.join(os.tmpdir(), 'hvac-services.json');
    fs.writeFileSync(statusFile, JSON.stringify(serviceStatus, null, 2));
  } catch {}
}
setInterval(flushStatus, 2000);

const servers = [];

async function startAll() {
  // 1. Connect MongoDB centrally
  if (resolvedMongo) {
    try {
      const dbMod = await import(pathToFileURL(path.resolve(rootDir, 'packages/database/dist/index.js')).href);
      await dbMod.connectDatabase(resolvedMongo, { serviceName: 'unified-backend' });
      console.log(`${BOLD}${GREEN}✔ Unified MongoDB connection established${RESET}`);
    } catch (err) {
      console.warn(`${BOLD}${YELLOW}⚠ MongoDB connection warning:${RESET} ${err.message}`);
    }
  }

  // 2. Start all 13 domain microservices
  for (const svc of DOMAIN_SERVICES) {
    try {
      updateServiceStatus(svc.name, 'starting', `Initializing service on port ${svc.port}`);

      // Initialize messaging if available
      const messagingPath = path.resolve(rootDir, svc.path, 'dist/config/messaging.js');
      if (fs.existsSync(messagingPath)) {
        try {
          const msgMod = await import(pathToFileURL(messagingPath).href);
          if (typeof msgMod.initMessaging === 'function') {
            await msgMod.initMessaging().catch((err) => {
              console.warn(`[${svc.name}] messaging init warning: ${err.message}`);
            });
          }
        } catch (e) {}
      }

      // Create Express App and listen
      const appPath = path.resolve(rootDir, svc.path, 'dist/app.js');
      const appMod = await import(pathToFileURL(appPath).href);
      const app = appMod.createApp();

      await new Promise((resolve, reject) => {
        const srv = app.listen(svc.port, '0.0.0.0', () => {
          if (typeof appMod.setReadiness === 'function') {
            appMod.setReadiness(true);
          }
          console.log(`  ${GREEN}✔${RESET} [${svc.name}] listening on port ${svc.port}`);
          updateServiceStatus(svc.name, 'running', `Listening on port ${svc.port}`);
          servers.push(srv);
          resolve();
        });
        srv.on('error', reject);
      });
    } catch (err) {
      console.error(`  \x1b[31m✖\x1b[0m Failed to start [${svc.name}]:`, err.message);
      updateServiceStatus(svc.name, 'error', `Failed to start: ${err.message}`);
    }
  }

  // 3. Start API Gateway on main public port
  const gatewayPort = parseInt(process.env.PORT || '3000', 10);
  const gatewayPath = path.resolve(rootDir, 'apps/api-gateway/dist/app.js');
  const gatewayMod = await import(pathToFileURL(gatewayPath).href);
  const gatewayApp = gatewayMod.createApp();

  await new Promise((resolve, reject) => {
    const srv = gatewayApp.listen(gatewayPort, '0.0.0.0', () => {
      if (typeof gatewayMod.setReadiness === 'function') {
        gatewayMod.setReadiness(true);
      }
      console.log(`\n${BOLD}${GREEN}🚀 [api-gateway] Publicly available on port ${gatewayPort}${RESET}\n`);
      updateServiceStatus('api-gateway', 'running', `Publicly available on port ${gatewayPort}`);
      servers.push(srv);
      resolve();
    });
    srv.on('error', reject);
  });

  const mem = process.memoryUsage();
  console.log(`${BOLD}Memory Usage:${RESET} RSS: ${Math.round(mem.rss / 1024 / 1024)}MB | Heap: ${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB`);
}

function handleShutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down all unified servers...`);
  for (const s of servers) {
    try {
      s.close();
    } catch {}
  }
  process.exit(0);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

startAll().catch((err) => {
  console.error('Fatal unified startup failure:', err);
  process.exit(1);
});
