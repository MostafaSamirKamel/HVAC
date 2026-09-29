import { randomUUID } from 'crypto';
import { NotFoundError } from '@hvac/errors';
import { IStorageService, UploadFileInput, FileMetadata, PresignedUrlOptions } from './types.js';
import { validateFileUpload } from './validator.js';

export class MemoryStorageService implements IStorageService {
  private readonly store = new Map<string, { buffer: Buffer; metadata: FileMetadata }>();
  private readonly bucket: string;

  constructor(bucket: string = 'hvac-erp-attachments') {
    this.bucket = bucket;
  }

  public async upload(input: UploadFileInput): Promise<FileMetadata> {
    const buffer = Buffer.isBuffer(input.file) ? input.file : Buffer.from(input.file);
    validateFileUpload(input.fileName, input.mimeType, buffer.length, input.category);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const safeName = input.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${input.companyId}/${input.category.toLowerCase()}/${year}/${month}/${randomUUID()}-${safeName}`;

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
      url: `memory://${this.bucket}/${key}`,
    };

    this.store.set(key, { buffer, metadata });
    return metadata;
  }

  public async download(key: string): Promise<Buffer> {
    const item = this.store.get(key);
    if (!item) {
      throw new NotFoundError(`File not found with key: ${key}`);
    }
    return item.buffer;
  }

  public async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  public async getPresignedUrl(key: string, _options?: PresignedUrlOptions): Promise<string> {
    if (!this.store.has(key)) {
      throw new NotFoundError(`File not found with key: ${key}`);
    }
    return `https://storage.hvac-erp.local/${this.bucket}/${key}?token=mock-presigned-${randomUUID()}`;
  }

  public async getPresignedUploadUrl(key: string, _options?: PresignedUrlOptions): Promise<string> {
    return `https://storage.hvac-erp.local/${this.bucket}/${key}?action=upload&token=mock-presigned-${randomUUID()}`;
  }

  public async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  public clear(): void {
    this.store.clear();
  }
}
