/**
 * Unit Tests for Document Upload Service
 * Tests file validation, upload logic, and Inngest event emission
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateFile } from '../upload-service';

describe('Document Upload Service', () => {
  describe('validateFile', () => {
    it('should accept valid PDF files under 25MB', () => {
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 }); // 1MB

      const result = validateFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid JPEG files', () => {
      const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 }); // 1MB

      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    it('should accept valid PNG files', () => {
      const file = new File(['test'], 'image.png', { type: 'image/png' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 }); // 1MB

      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    it('should accept valid DOCX files', () => {
      const file = new File(['test'], 'document.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 }); // 1MB

      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    it('should reject files over 25MB', () => {
      const file = new File(['test'], 'large.pdf', { type: 'application/pdf' });
      Object.defineProperty(file, 'size', { value: 30 * 1024 * 1024 }); // 30MB

      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('trop volumineux');
      expect(result.error).toContain('25 Mo');
    });

    it('should reject invalid MIME types', () => {
      const file = new File(['test'], 'script.exe', { type: 'application/x-msdownload' });
      Object.defineProperty(file, 'size', { value: 1024 }); // 1KB

      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('non autorisé');
    });

    it('should reject files with mismatched extensions', () => {
      const file = new File(['test'], 'fake.pdf.exe', { type: 'application/pdf' });
      Object.defineProperty(file, 'size', { value: 1024 }); // 1KB

      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('non valide');
    });

    it('should reject files with no extension', () => {
      const file = new File(['test'], 'noextension', { type: 'application/pdf' });
      Object.defineProperty(file, 'size', { value: 1024 }); // 1KB

      const result = validateFile(file);
      expect(result.valid).toBe(false);
    });

    it('should accept files at exactly 25MB limit', () => {
      const file = new File(['test'], 'limit.pdf', { type: 'application/pdf' });
      Object.defineProperty(file, 'size', { value: 25 * 1024 * 1024 }); // Exactly 25MB

      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    it('should handle case-insensitive extensions', () => {
      const file = new File(['test'], 'TEST.PDF', { type: 'application/pdf' });
      Object.defineProperty(file, 'size', { value: 1024 }); // 1KB

      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    it('should provide helpful error messages in French', () => {
      const largeFile = new File(['test'], 'large.pdf', { type: 'application/pdf' });
      Object.defineProperty(largeFile, 'size', { value: 50 * 1024 * 1024 }); // 50MB

      const result = validateFile(largeFile);
      expect(result.error).toMatch(/Mo/); // French abbreviation
      expect(result.error).toMatch(/taille maximale/i);
    });

    it('should accept all allowed MIME types', () => {
      const allowedTypes = [
        { type: 'application/pdf', ext: '.pdf' },
        { type: 'image/jpeg', ext: '.jpg' },
        { type: 'image/png', ext: '.png' },
        {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ext: '.docx',
        },
      ];

      allowedTypes.forEach(({ type, ext }) => {
        const file = new File(['test'], `file${ext}`, { type });
        Object.defineProperty(file, 'size', { value: 1024 });

        const result = validateFile(file);
        expect(result.valid).toBe(true);
      });
    });

    it('should reject common malicious extensions', () => {
      const maliciousExtensions = [
        { ext: '.exe', type: 'application/x-msdownload' },
        { ext: '.bat', type: 'application/x-bat' },
        { ext: '.sh', type: 'application/x-sh' },
        { ext: '.zip', type: 'application/zip' },
      ];

      maliciousExtensions.forEach(({ ext, type }) => {
        const file = new File(['test'], `malicious${ext}`, { type });
        Object.defineProperty(file, 'size', { value: 1024 });

        const result = validateFile(file);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('File Size Formatting', () => {
    it('should format file size correctly in error messages', () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      Object.defineProperty(file, 'size', { value: 26.5 * 1024 * 1024 }); // 26.5MB

      const result = validateFile(file);
      expect(result.error).toMatch(/26\.50 Mo/); // Should show 2 decimal places
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty filename', () => {
      const file = new File(['test'], '', { type: 'application/pdf' });
      Object.defineProperty(file, 'size', { value: 1024 });

      const result = validateFile(file);
      expect(result.valid).toBe(false);
    });

    it('should handle filename with multiple dots', () => {
      const file = new File(['test'], 'my.document.final.pdf', { type: 'application/pdf' });
      Object.defineProperty(file, 'size', { value: 1024 });

      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    it('should handle zero-byte files', () => {
      const file = new File([], 'empty.pdf', { type: 'application/pdf' });
      Object.defineProperty(file, 'size', { value: 0 });

      const result = validateFile(file);
      expect(result.valid).toBe(true); // Zero bytes is valid
    });
  });
});
