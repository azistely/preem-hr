/**
 * Documents tRPC Router
 *
 * Handles document generation for employee terminations:
 * - Work certificates (Certificat de Travail)
 * - CNPS attestations
 * - Final payslips
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../api/trpc';
import { generateWorkCertificate } from '@/features/documents/services/work-certificate.service';
import { generateCNPSAttestation } from '@/features/documents/services/cnps-attestation.service';
import { generateFinalPayslip } from '@/features/documents/services/final-payslip.service';
import { TRPCError } from '@trpc/server';

const generateWorkCertificateSchema = z.object({
  terminationId: z.string().uuid(),
  issuedBy: z.string().min(1, 'Le nom du signataire est requis'),
});

const generateCNPSAttestationSchema = z.object({
  terminationId: z.string().uuid(),
  issuedBy: z.string().min(1, 'Le nom du signataire est requis'),
});

const generateFinalPayslipSchema = z.object({
  terminationId: z.string().uuid(),
  payDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)'),
});

export const documentsRouter = createTRPCRouter({
  /**
   * Generate work certificate (Certificat de Travail)
   * Must be issued within 48 hours of termination per Convention Collective Article 40
   */
  generateWorkCertificate: publicProcedure
    .input(generateWorkCertificateSchema)
    .mutation(async ({ input, ctx }) => {
      console.log('[TRPC Documents] generateWorkCertificate called with input:', JSON.stringify(input));
      console.log('[TRPC Documents] Context tenantId:', ctx.user.tenantId);

      try {
        console.log('[TRPC Documents] About to call generateWorkCertificate service');
        const result = await generateWorkCertificate({
          terminationId: input.terminationId,
          tenantId: ctx.user.tenantId,
          issuedBy: input.issuedBy,
        });
        console.log('[TRPC Documents] Service returned successfully');

        return result;
      } catch (error: any) {
        console.error('[Work Certificate] Generation error:', error);
        console.error('[Work Certificate] Error stack:', error.stack);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la génération du certificat de travail',
        });
      }
    }),

  /**
   * Generate CNPS attestation
   * Must be issued within 15 days of termination per Convention Collective Article 40
   */
  generateCNPSAttestation: publicProcedure
    .input(generateCNPSAttestationSchema)
    .mutation(async ({ input, ctx }) => {
      console.log('[TRPC Documents] generateCNPSAttestation called with input:', JSON.stringify(input));
      console.log('[TRPC Documents] Context tenantId:', ctx.user.tenantId);

      try {
        console.log('[TRPC Documents] About to call generateCNPSAttestation service');
        const result = await generateCNPSAttestation({
          terminationId: input.terminationId,
          tenantId: ctx.user.tenantId,
          issuedBy: input.issuedBy,
        });
        console.log('[TRPC Documents] Service returned successfully');

        return result;
      } catch (error: any) {
        console.error('[CNPS Attestation] Generation error:', error);
        console.error('[CNPS Attestation] Error stack:', error.stack);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la génération de l\'attestation CNPS',
        });
      }
    }),

  /**
   * Generate final payslip with terminal payments
   * Includes severance pay, vacation payout, and prorated salary
   */
  generateFinalPayslip: publicProcedure
    .input(generateFinalPayslipSchema)
    .mutation(async ({ input, ctx }) => {
      console.log('[TRPC Documents] generateFinalPayslip called with input:', JSON.stringify(input));
      console.log('[TRPC Documents] Context tenantId:', ctx.user.tenantId);

      try {
        console.log('[TRPC Documents] About to call generateFinalPayslip service');
        const result = await generateFinalPayslip({
          terminationId: input.terminationId,
          tenantId: ctx.user.tenantId,
          payDate: input.payDate,
        });
        console.log('[TRPC Documents] Service returned successfully');

        return result;
      } catch (error: any) {
        console.error('[Final Payslip] Generation error:', error);
        console.error('[Final Payslip] Error stack:', error.stack);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la génération du bulletin de paie final',
        });
      }
    }),
});
