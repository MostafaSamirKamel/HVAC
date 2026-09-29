import { createLogger } from '@hvac/logger';
const logger = createLogger({ serviceName: 'seeder' });
async function main() { logger.info('Seeding database with demo HVAC ERP data...'); }
main();
