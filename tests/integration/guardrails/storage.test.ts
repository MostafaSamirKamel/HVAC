import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorageService, validateFileUpload } from '../../../packages/storage/src/index.js';
import { ValidationError } from '@hvac/errors';

describe('Phase 15: S3-Compatible Object Storage & Attachment Safety (Blueprint v2.0 Section 48)', () => {
  let storage: MemoryStorageService;

  beforeEach(() => {
    storage = new MemoryStorageService('test-attachments');
  });

  describe('File Upload Validation', () => {
    it('should allow valid image and document uploads', () => {
      expect(() => validateFileUpload('work-order-photo.jpg', 'image/jpeg', 1024, 'WORK_ORDER_PHOTO')).not.toThrow();
      expect(() => validateFileUpload('invoice-receipt.pdf', 'application/pdf', 50000, 'INVOICE')).not.toThrow();
      expect(() => validateFileUpload('warranty-card.png', 'image/png', 2048, 'WARRANTY_FILE')).not.toThrow();
      expect(() => validateFileUpload('expense-sheet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 10000, 'EXPENSE_ATTACHMENT')).not.toThrow();
    });

    it('should reject prohibited file extensions and mime types', () => {
      expect(() => validateFileUpload('malware.exe', 'application/x-msdownload', 1024, 'OTHER')).toThrow(ValidationError);
      expect(() => validateFileUpload('script.sh', 'text/x-shellscript', 1024, 'OTHER')).toThrow(ValidationError);
      expect(() => validateFileUpload('exploit.js', 'application/javascript', 1024, 'OTHER')).toThrow(ValidationError);
    });

    it('should reject path traversal attempts in filenames', () => {
      expect(() => validateFileUpload('../../etc/passwd.jpg', 'image/jpeg', 1024, 'OTHER')).toThrow(ValidationError);
      expect(() => validateFileUpload('..\\windows\\system32.png', 'image/png', 1024, 'OTHER')).toThrow(ValidationError);
    });

    it('should reject files exceeding 25MB maximum limit', () => {
      const overSize = 26 * 1024 * 1024;
      expect(() => validateFileUpload('large-photo.jpg', 'image/jpeg', overSize, 'WORK_ORDER_PHOTO')).toThrow(ValidationError);
    });

    it('should reject extension mismatching declared MIME type', () => {
      expect(() => validateFileUpload('document.pdf', 'image/png', 1024, 'INVOICE')).toThrow(ValidationError);
    });
  });

  describe('Storage CRUD Operations', () => {
    it('should successfully upload file and return structured metadata with company isolation', async () => {
      const fileBuffer = Buffer.from('Mock PDF Content for HVAC Invoice #1002');
      const metadata = await storage.upload({
        file: fileBuffer,
        fileName: 'invoice-1002.pdf',
        mimeType: 'application/pdf',
        category: 'INVOICE',
        companyId: 'comp_cairo_hvac',
        branchId: 'br_nasr_city',
        uploadedBy: 'usr_accountant_01',
      });

      expect(metadata.key).toContain('comp_cairo_hvac/invoice/');
      expect(metadata.key).toContain('invoice-1002.pdf');
      expect(metadata.originalName).toBe('invoice-1002.pdf');
      expect(metadata.sizeBytes).toBe(fileBuffer.length);
      expect(metadata.category).toBe('INVOICE');
      expect(metadata.uploadedBy).toBe('usr_accountant_01');
      expect(metadata.url).toBeDefined();

      const exists = await storage.exists(metadata.key);
      expect(exists).toBe(true);

      const downloaded = await storage.download(metadata.key);
      expect(downloaded.toString()).toBe('Mock PDF Content for HVAC Invoice #1002');

      const presignedUrl = await storage.getPresignedUrl(metadata.key);
      expect(presignedUrl).toContain('mock-presigned');

      const deleted = await storage.delete(metadata.key);
      expect(deleted).toBe(true);

      const existsAfter = await storage.exists(metadata.key);
      expect(existsAfter).toBe(false);
    });
  });
});
