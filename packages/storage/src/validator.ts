import { ValidationError } from '@hvac/errors';
import { FileCategory } from './types.js';

export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

export const MIME_TO_EXTENSION: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/heic': ['.heic'],
  'application/pdf': ['.pdf'],
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
};

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export function validateFileUpload(fileName: string, mimeType: string, sizeBytes: number, category: FileCategory): void {
  if (!fileName || fileName.trim() === '') {
    throw new ValidationError('File name must be specified');
  }

  // Prevent path traversal
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    throw new ValidationError('Invalid characters in file name');
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
    throw new ValidationError(`Unsupported file type: ${mimeType}. Allowed formats: JPG, PNG, WEBP, PDF, CSV, XLSX.`);
  }

  if (sizeBytes <= 0) {
    throw new ValidationError('File cannot be empty');
  }

  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError(`File size exceeds maximum allowed limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`);
  }

  // Verify file extension matches declared mime type
  const lowerFileName = fileName.toLowerCase();
  const allowedExtensions = MIME_TO_EXTENSION[mimeType.toLowerCase()] || [];
  const hasValidExtension = allowedExtensions.some((ext) => lowerFileName.endsWith(ext));

  if (!hasValidExtension) {
    throw new ValidationError(`File extension does not match MIME type ${mimeType}`);
  }
}
