export type FileCategory =
  | 'INVOICE'
  | 'RECEIPT'
  | 'EXPENSE_ATTACHMENT'
  | 'WORK_ORDER_PHOTO'
  | 'WARRANTY_FILE'
  | 'APPROVAL_ATTACHMENT'
  | 'RETURN_PHOTO'
  | 'CONTRACT_DOCUMENT'
  | 'OTHER';

export interface FileMetadata {
  key: string;
  bucket: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  category: FileCategory;
  companyId: string;
  branchId?: string;
  uploadedBy: string;
  uploadedAt: string;
  etag?: string;
  url?: string;
}

export interface UploadFileInput {
  file: Buffer | Uint8Array;
  fileName: string;
  mimeType: string;
  category: FileCategory;
  companyId: string;
  branchId?: string;
  uploadedBy: string;
}

export interface PresignedUrlOptions {
  expiresInSeconds?: number;
  contentType?: string;
}

export interface StorageConfig {
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  useSsl?: boolean;
  publicUrlPrefix?: string;
}

export interface IStorageService {
  upload(input: UploadFileInput): Promise<FileMetadata>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<boolean>;
  getPresignedUrl(key: string, options?: PresignedUrlOptions): Promise<string>;
  getPresignedUploadUrl(key: string, options?: PresignedUrlOptions): Promise<string>;
  exists(key: string): Promise<boolean>;
}
