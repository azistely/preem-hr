/**
 * Inngest Background Function: Termination Processing
 *
 * Handles the complete termination flow including:
 * - STC (Solde de Tout Compte) calculation
 * - Work Certificate generation (48h deadline per Convention Collective Art. 40)
 * - Final Payslip generation (includes terminal payroll calculation)
 * - CNPS Attestation generation (15 day deadline per Convention Collective Art. 40)
 *
 * Designed for West African 3G connections with unreliable connectivity.
 * Uses step functions for durability and automatic retry on failure.
 *
 * Features:
 * - Real-time progress updates via employee_terminations table
 * - Automatic retry with exponential backoff (3 retries per step)
 * - STC results saved immediately after calculation
 * - Email notification on completion
 */

import { inngest, sendEvent } from '../client';
import { db } from '@/lib/db';
import { employeeTerminations } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { calculateSTC, type STCCalculationInput, type DepartureType, type NoticePeriodStatus, type LicenciementType } from '@/features/payroll/services/stc-calculator.service';
import { generateWorkCertificate } from '@/features/documents/services/work-certificate.service';
import { generateFinalPayslip } from '@/features/documents/services/final-payslip.service';
import { generateCNPSAttestation } from '@/features/documents/services/cnps-attestation.service';

/**
 * Helper function to update progress in the database
 */
async function updateProgress(
  terminationId: string,
  tenantId: string,
  status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed',
  progress: number,
  currentStep?: string,
  error?: string
) {
  await db.update(employeeTerminations)
    .set({
      processingStatus: status,
      processingProgress: progress,
      processingCurrentStep: currentStep,
      processingError: error || null,
      ...(status === 'completed' ? { processingCompletedAt: new Date().toISOString() } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(and(
      eq(employeeTerminations.id, terminationId),
      eq(employeeTerminations.tenantId, tenantId)
    ));
}

/**
 * Helper function to save STC results to the termination record
 */
async function saveSTCResults(
  terminationId: string,
  tenantId: string,
  stcResult: {
    severancePay: number;
    vacationPayout: number;
    gratification: number;
    proratedSalary: number;
    noticePayment: number;
    grossSalary: number;
    netToPay: number;
    calculationDetails: {
      yearsOfService: number;
      averageSalary12M: number;
    };
  }
) {
  await db.update(employeeTerminations)
    .set({
      severanceAmount: stcResult.severancePay.toString(),
      vacationPayoutAmount: stcResult.vacationPayout.toString(),
      gratificationAmount: stcResult.gratification.toString(),
      proratedSalary: stcResult.proratedSalary.toString(),
      noticePaymentAmount: stcResult.noticePayment.toString(),
      totalGross: stcResult.grossSalary.toString(),
      totalNet: stcResult.netToPay.toString(),
      yearsOfService: stcResult.calculationDetails.yearsOfService.toString(),
      averageSalary12M: stcResult.calculationDetails.averageSalary12M.toString(),
      stcCalculatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(and(
      eq(employeeTerminations.id, terminationId),
      eq(employeeTerminations.tenantId, tenantId)
    ));
}

/**
 * Event payload type for termination.process event
 */
interface TerminationProcessEventData {
  terminationId: string;
  tenantId: string;
  employeeId: string;
  departureType: DepartureType;
  terminationDate: string; // ISO date
  noticePeriodStatus: NoticePeriodStatus;
  licenciementType?: LicenciementType;
  ruptureNegotiatedAmount?: number;
  issuedBy: string;
  payDate: string; // ISO date
  uploadedByUserId: string;
}

/**
 * Background Termination Processing Function
 *
 * Triggered by: termination.process event
 * Called from: tRPC startTerminationProcessing endpoint
 *
 * This function handles the complete termination workflow:
 * 1. Calculate STC (Solde de Tout Compte) - the heavy computation
 * 2. Generate Work Certificate (Certificat de Travail)
 * 3. Generate Final Payslip (includes terminal payroll calculation)
 * 4. Generate CNPS Attestation
 * 5. Send completion notification
 */
export const terminationProcessingFunction = inngest.createFunction(
  {
    id: 'termination-processing',
    name: 'Process Employee Termination (STC + Documents)',
    retries: 3,

    // Concurrency control: max 2 terminations at a time per tenant
    concurrency: [
      {
        limit: 2,
        key: 'event.data.tenantId',
      },
    ],
  },

  { event: 'termination.process' },

  async ({ event, step }) => {
    const {
      terminationId,
      tenantId,
      employeeId,
      departureType,
      terminationDate,
      noticePeriodStatus,
      licenciementType,
      ruptureNegotiatedAmount,
      issuedBy,
      payDate,
      uploadedByUserId,
    } = event.data as TerminationProcessEventData;

    console.log('[Inngest] Starting termination processing:', {
      terminationId,
      employeeId,
      departureType,
      tenantId,
    });

    // Step 1: Calculate STC (Solde de Tout Compte)
    // This is the heavy computation that was timing out on 3G connections
    const stcResult = await step.run('calculate-stc', async () => {
      console.log('[Inngest] Step 1: Calculating STC...');
      await updateProgress(terminationId, tenantId, 'processing', 5, 'Calcul des indemnités...');

      try {
        const result = await calculateSTC({
          employeeId,
          tenantId,
          departureType,
          terminationDate: new Date(terminationDate),
          noticePeriodStatus,
          licenciementType,
          ruptureNegotiatedAmount,
        });

        // Save STC results immediately so user can see them
        await saveSTCResults(terminationId, tenantId, result);
        await updateProgress(terminationId, tenantId, 'processing', 20, 'Indemnités calculées');

        console.log('[Inngest] STC calculation complete:', {
          severancePay: result.severancePay,
          netToPay: result.netToPay,
        });

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur lors du calcul STC';
        await updateProgress(terminationId, tenantId, 'failed', 5, 'Calcul des indemnités échoué', errorMessage);
        throw error;
      }
    });

    // Step 2: Generate Work Certificate (Certificat de Travail)
    await step.run('generate-work-certificate', async () => {
      console.log('[Inngest] Step 2: Generating Work Certificate...');
      await updateProgress(terminationId, tenantId, 'processing', 25, 'Certificat de travail...');

      try {
        const result = await generateWorkCertificate({
          terminationId,
          tenantId,
          issuedBy,
          uploadedByUserId,
        });

        await updateProgress(terminationId, tenantId, 'processing', 40, 'Certificat généré');
        console.log('[Inngest] Work Certificate generated:', result.url);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la génération du certificat';
        await updateProgress(terminationId, tenantId, 'failed', 25, 'Certificat de travail échoué', errorMessage);
        throw error;
      }
    });

    // Step 3: Generate Final Payslip (includes terminal payroll calculation)
    await step.run('generate-final-payslip', async () => {
      console.log('[Inngest] Step 3: Generating Final Payslip...');
      await updateProgress(terminationId, tenantId, 'processing', 45, 'Bulletin de paie final...');

      try {
        const result = await generateFinalPayslip({
          terminationId,
          tenantId,
          payDate,
          uploadedByUserId,
        });

        await updateProgress(terminationId, tenantId, 'processing', 70, 'Bulletin généré');
        console.log('[Inngest] Final Payslip generated:', result.url);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la génération du bulletin';
        await updateProgress(terminationId, tenantId, 'failed', 45, 'Bulletin de paie échoué', errorMessage);
        throw error;
      }
    });

    // Step 4: Generate CNPS Attestation
    await step.run('generate-cnps-attestation', async () => {
      console.log('[Inngest] Step 4: Generating CNPS Attestation...');
      await updateProgress(terminationId, tenantId, 'processing', 75, 'Attestation CNPS...');

      try {
        const result = await generateCNPSAttestation({
          terminationId,
          tenantId,
          issuedBy,
          uploadedByUserId,
        });

        await updateProgress(terminationId, tenantId, 'processing', 90, 'Attestation générée');
        console.log('[Inngest] CNPS Attestation generated:', result.url);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Erreur lors de la génération de l'attestation";
        await updateProgress(terminationId, tenantId, 'failed', 75, 'Attestation CNPS échouée', errorMessage);
        throw error;
      }
    });

    // Step 5: Mark complete and send notification
    await step.run('complete-and-notify', async () => {
      console.log('[Inngest] Step 5: Completing and sending notification...');
      await updateProgress(terminationId, tenantId, 'completed', 100, 'Terminé!');

      // Send completion event for downstream handlers (email notification, etc.)
      await sendEvent({
        name: 'termination.processing.completed',
        data: {
          terminationId,
          tenantId,
          employeeId,
          stcNetAmount: stcResult.netToPay,
        },
      });

      console.log('[Inngest] Termination processing completed successfully');
    });

    return {
      success: true,
      terminationId,
      stcResult: {
        severancePay: stcResult.severancePay,
        vacationPayout: stcResult.vacationPayout,
        gratification: stcResult.gratification,
        netToPay: stcResult.netToPay,
      },
    };
  }
);

/**
 * Failure Handler for Termination Processing
 *
 * Updates the termination status to failed when processing fails after all retries.
 */
export const terminationProcessingFailedFunction = inngest.createFunction(
  {
    id: 'termination-processing-failed',
    name: 'Handle Termination Processing Failure',
  },

  { event: 'inngest/function.failed' },

  async ({ event, step }) => {
    // Only handle failures from termination-processing function
    if (event.data.function_id !== 'termination-processing') {
      return { skipped: true };
    }

    const originalEvent = event.data.event;
    const { terminationId, tenantId } = originalEvent.data;
    const errorMessage = event.data.error?.message ?? 'Erreur inconnue';

    console.log('[Inngest] Termination processing failed after retries:', {
      terminationId,
      error: errorMessage,
    });

    // Update the termination status to failed
    await step.run('update-status-failed', async () => {
      await updateProgress(terminationId, tenantId, 'failed', 0, 'Échec du traitement', errorMessage);
    });

    // Send failure event for notification
    await step.run('send-failure-event', async () => {
      await sendEvent({
        name: 'termination.processing.failed',
        data: {
          terminationId,
          tenantId,
          errorMessage,
        },
      });
    });

    return {
      handled: true,
      terminationId,
      error: errorMessage,
    };
  }
);
