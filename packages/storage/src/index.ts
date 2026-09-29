import { StorageConfig, IStorageService } from './types.js';
import { MemoryStorageService } from './memory-storage.js';
import { S3StorageService } from './s3-storage.js';

export * from './types.js';
export * from './validator.js';
export * from './memory-storage.js';
export * from './s3-storage.js';

export function createStorageService(config?: StorageConfig): IStorageService {
  if (process.env.NODE_ENV === 'test' || process.env.STORAGE_DRIVER === 'memory') {
    return new MemoryStorageService(config?.bucket);
  }
  return new S3StorageService(config);
}
