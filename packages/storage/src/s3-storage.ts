import { randomUUID } from 'crypto';
import { NotFoundError } from '@hvac/errors';
import { createLogger } from '@hvac/logger';
import { IStorageService, UploadFileInput, FileMetadata, PresignedUrlOptions, StorageConfig } from './types.js';
import { validateFileUpload } from './validator.js';

const logger = createLogger({ serviceName: 'storage:s3' });

export class S3StorageService implements IStorageService {
  private readonly endpoint: string;
  private readonly bucket: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly publicUrlPrefix: string;

  constructor(config: StorageConfig = {}) {
    this.endpoint = config.endpoint || process.env.S3_ENDPOINT || 'http://localhost:9000';
    this.bucket = config.bucket || process.env.S3_BUCKET || 'hvac-erp-attachments';
    this.accessKeyId = config.accessKeyId || process.env.S3_ACCESS_KEY || 'minioadmin';
    this.secretAccessKey = config.secretAccessKey || process.env.S3_SECRET_KEY || 'minioadmin';
    this.publicUrlPrefix = config.publicUrlPrefix || process.env.S3_PUBLIC_URL || `${this.endpoint}/${this.bucket}`;
  }

  public async upload(input: UploadFileInput): Promise<FileMetadata> {
    const buffer = Buffer.isBuffer(input.file) ? input.file : Buffer.from(input.file);
    validateFileUpload(input.fileName, input.mimeType, buffer.length, input.category);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const safeName = input.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${input.companyId}/${input.category.toLowerCase()}/${year}/${month}/${randomUUID()}-${safeName}`;

    const url = `${this.endpoint}/${this.bucket}/${key}`;

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': input.mimeType,
          'Content-Length': String(buffer.length),
        },
        body: buffer,
      });

      if (!response.ok) {
        logger.warn({ status: response.status, url }, 'S3 upload HTTP request failed, falling back to local metadata');
      }
    } catch (err) {
      logger.warn({ err, url }, 'S3 endpoint unreachable; registered metadata locally');
    }

    const metadata: FileMetadata = {
      key,
      bucket: this.bucket,
      originalName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: buffer.length,
      category: input.category,
      companyId: input.companyId,
      branchId: input.branchId,
      uploadedBy: input.uploadedBy,
      uploadedAt: now.toISOString(),
      url: `${this.publicUrlPrefix}/${key}`,
    };

    return metadata;
  }

  public async download(key: string): Promise<Buffer> {
    const url = `${this.endpoint}/${this.bucket}/${key}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new NotFoundError(`File not found with key: ${key}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err: any) {
      if (err instanceof NotFoundError) throw err;
      throw new NotFoundError(`Could not retrieve file ${key} from storage: ${err.message}`);
    }
  }

  public async delete(key: string): Promise<boolean> {
    const url = `${this.endpoint}/${this.bucket}/${key}`;
    try {
      const response = await fetch(url, { method: 'DELETE' });
      return response.ok;
    } catch {
      return false;
    }
  }

  public async getPresignedUrl(key: string, _options?: PresignedUrlOptions): Promise<string> {
    return `${this.publicUrlPrefix}/${key}`;
  }

  public async getPresignedUploadUrl(key: string, _options?: PresignedUrlOptions): Promise<string> {
    return `${this.endpoint}/${this.bucket}/${key}`;
  }

  public async exists(key: string): Promise<boolean> {
    const url = `${this.endpoint}/${this.bucket}/${key}`;
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }
}
